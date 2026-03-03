// Package commands implements the LISTEN/NOTIFY pattern for bridge commands.
// The frontend inserts rows into wa_bridge.bridge_commands; this package claims
// and dispatches them. Currently supports the "history_sync" command type.
package commands

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/lib/pq"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waHistorySync"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"

	"whatsapp-bridge/internal/logging"
	"whatsapp-bridge/internal/store"
)

var log = logging.Component("commands")

const syncTimeout = 60 * time.Second

// pendingSync tracks an in-flight history sync request.
type pendingSync struct {
	commandID int64
	chatJID   types.JID
	timer     *time.Timer
}

// Listener processes bridge commands from the database.
type Listener struct {
	client      *whatsmeow.Client
	db          *store.Store
	databaseURL string

	mu           sync.Mutex
	pendingSyncs map[string]*pendingSync // keyed by chat JID string
}

// New creates a new commands Listener.
func New(client *whatsmeow.Client, db *store.Store, databaseURL string) *Listener {
	return &Listener{
		client:       client,
		db:           db,
		databaseURL:  databaseURL,
		pendingSyncs: make(map[string]*pendingSync),
	}
}

// Listen subscribes to the bridge_command Postgres channel and processes
// commands as they arrive. It also drains any commands that were pending before
// the listener started. Blocks until ctx is cancelled.
func (l *Listener) Listen(ctx context.Context) {
	reportProblem := func(ev pq.ListenerEventType, err error) {
		if err != nil {
			log.Error().Err(err).Msg("commands listener error")
		}
	}

	listener := pq.NewListener(l.databaseURL, 10*time.Second, time.Minute, reportProblem)
	if err := listener.Listen("bridge_command"); err != nil {
		log.Error().Err(err).Msg("failed to LISTEN on bridge_command")
		return
	}
	log.Info().Msg("listening for bridge commands on bridge_command channel")

	l.processPending(ctx)

	for {
		select {
		case <-ctx.Done():
			listener.Close()
			return
		case n := <-listener.Notify:
			if n == nil {
				log.Info().Msg("commands listener reconnected, checking pending commands")
				l.processPending(ctx)
				continue
			}
			var payload struct {
				ID int64 `json:"id"`
			}
			if err := json.Unmarshal([]byte(n.Extra), &payload); err != nil {
				log.Error().Err(err).Msg("failed to parse bridge_command notification")
				continue
			}
			go l.processOne(ctx, payload.ID)
		}
	}
}

func (l *Listener) processPending(ctx context.Context) {
	// Recover commands stuck in 'processing' from a previous crash.
	if n, err := l.db.ResetStaleProcessingCommands(ctx); err != nil {
		log.Error().Err(err).Msg("failed to reset stale processing commands")
	} else if n > 0 {
		log.Warn().Int64("count", n).Msg("reset stale processing commands from previous crash")
	}

	ids, err := l.db.PendingCommandIDs(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to query pending commands")
		return
	}
	for _, id := range ids {
		l.processOne(ctx, id)
	}
	if len(ids) > 0 {
		log.Info().Int("count", len(ids)).Msg("processed pending bridge commands")
	}
}

func (l *Listener) processOne(ctx context.Context, id int64) {
	cmd, err := l.db.ClaimCommand(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return
		}
		log.Error().Err(err).Int64("command_id", id).Msg("failed to claim command")
		return
	}

	log.Info().Int64("command_id", cmd.ID).Str("type", cmd.CommandType).Str("chat_id", cmd.ChatID).Msg("processing command")

	switch cmd.CommandType {
	case "history_sync":
		l.handleHistorySync(ctx, cmd)
	default:
		l.db.MarkCommandFailed(ctx, cmd.ID, fmt.Sprintf("unknown command type: %s", cmd.CommandType))
	}
}

// historySyncPayload is the expected JSON shape for history_sync commands.
type historySyncPayload struct {
	OldestMessageID string `json:"oldest_message_id"`
	OldestTimestamp string `json:"oldest_timestamp"`
	Count           int    `json:"count"`
}

func (l *Listener) handleHistorySync(ctx context.Context, cmd *store.BridgeCommand) {
	var payload historySyncPayload
	if err := json.Unmarshal(cmd.Payload, &payload); err != nil {
		l.db.MarkCommandFailed(ctx, cmd.ID, fmt.Sprintf("invalid payload: %v", err))
		return
	}

	chatJID, err := types.ParseJID(cmd.ChatID)
	if err != nil {
		l.db.MarkCommandFailed(ctx, cmd.ID, fmt.Sprintf("invalid chat_id JID: %v", err))
		return
	}

	// Check for duplicate in-flight sync for this chat.
	chatKey := chatJID.String()
	l.mu.Lock()
	if _, exists := l.pendingSyncs[chatKey]; exists {
		l.mu.Unlock()
		l.db.MarkCommandFailed(ctx, cmd.ID, "another history sync is already in progress for this chat")
		return
	}

	count := payload.Count
	if count <= 0 {
		count = 10
	}

	// Parse the oldest timestamp to build the MessageInfo anchor.
	oldestTS, err := time.Parse(time.RFC3339Nano, payload.OldestTimestamp)
	if err != nil {
		// Try parsing as a simpler format (Postgres timestamptz).
		oldestTS, err = time.Parse("2006-01-02T15:04:05", payload.OldestTimestamp)
		if err != nil {
			l.mu.Unlock()
			l.db.MarkCommandFailed(ctx, cmd.ID, fmt.Sprintf("invalid oldest_timestamp: %v", err))
			return
		}
	}

	// Determine isFromMe from the message ID.
	// WhatsApp message IDs from the user start with "3EB0" typically, but
	// we can't reliably infer this. We'll query the database.
	var isFromMe bool
	err = l.db.DB().QueryRowContext(ctx,
		`SELECT is_from_me FROM wa_bridge.messages WHERE message_id = $1 AND chat_id = $2`,
		payload.OldestMessageID, cmd.ChatID).Scan(&isFromMe)
	if err != nil && err != sql.ErrNoRows {
		l.mu.Unlock()
		l.db.MarkCommandFailed(ctx, cmd.ID, fmt.Sprintf("failed to look up oldest message: %v", err))
		return
	}

	msgInfo := &types.MessageInfo{
		MessageSource: types.MessageSource{
			Chat:     chatJID,
			IsFromMe: isFromMe,
		},
		ID:        types.MessageID(payload.OldestMessageID),
		Timestamp: oldestTS,
	}

	historySyncMsg := l.client.BuildHistorySyncRequest(msgInfo, count)

	// Send as a peer message to the phone (device 0), not the companion device.
	ownID := l.client.Store.ID
	if ownID == nil {
		l.mu.Unlock()
		l.db.MarkCommandFailed(ctx, cmd.ID, "not logged in to WhatsApp")
		return
	}
	phoneJID := types.NewJID(ownID.User, types.DefaultUserServer)
	phoneJID.Device = 0

	_, err = l.client.SendMessage(ctx, phoneJID, historySyncMsg, whatsmeow.SendRequestExtra{Peer: true})
	if err != nil {
		l.mu.Unlock()
		l.db.MarkCommandFailed(ctx, cmd.ID, fmt.Sprintf("failed to send history sync request: %v", err))
		return
	}

	// Register the pending sync with a timeout.
	timer := time.AfterFunc(syncTimeout, func() {
		l.mu.Lock()
		if ps, exists := l.pendingSyncs[chatKey]; exists && ps.commandID == cmd.ID {
			delete(l.pendingSyncs, chatKey)
			l.mu.Unlock()
			l.db.MarkCommandFailed(context.Background(), cmd.ID,
				"history sync timed out after 60s — phone may be offline or unreachable")
		} else {
			l.mu.Unlock()
		}
	})

	l.pendingSyncs[chatKey] = &pendingSync{
		commandID: cmd.ID,
		chatJID:   chatJID,
		timer:     timer,
	}
	l.mu.Unlock()

	log.Info().
		Int64("command_id", cmd.ID).
		Str("chat_id", cmd.ChatID).
		Str("oldest_msg", payload.OldestMessageID).
		Int("count", count).
		Msg("history sync request sent, waiting for response")
}

// HandleHistorySyncEvent is called from the event handler when an
// events.HistorySync event arrives. It matches ON_DEMAND syncs to pending
// commands, saves the messages, and marks the command as completed.
func (l *Listener) HandleHistorySyncEvent(evt *events.HistorySync) {
	data := evt.Data
	if data == nil {
		return
	}

	syncType := data.GetSyncType()
	log.Info().Str("sync_type", syncType.String()).Int("conversations", len(data.GetConversations())).Msg("history sync event received")

	// We only handle ON_DEMAND syncs triggered by our commands.
	if syncType != waHistorySync.HistorySync_ON_DEMAND {
		return
	}

	totalSaved := 0
	for _, conv := range data.GetConversations() {
		chatID := conv.GetID()
		if chatID == "" {
			continue
		}

		// Resolve @lid to @s.whatsapp.net so history messages share
		// the same chat_id as live messages.
		originalChatID := chatID
		if chatJID, err := types.ParseJID(chatID); err == nil && chatJID.Server == types.HiddenUserServer {
			if pnJID, err := l.client.Store.LIDs.GetPNForLID(context.Background(), chatJID); err == nil && !pnJID.IsEmpty() {
				chatID = pnJID.String()
			}
		}

		// Find the pending sync for this chat. Try the resolved ID first,
		// then fall back to the original in case the command used @lid.
		l.mu.Lock()
		ps, exists := l.pendingSyncs[chatID]
		if exists {
			ps.timer.Stop()
			delete(l.pendingSyncs, chatID)
		} else if originalChatID != chatID {
			ps, exists = l.pendingSyncs[originalChatID]
			if exists {
				ps.timer.Stop()
				delete(l.pendingSyncs, originalChatID)
			}
		}
		l.mu.Unlock()

		// Process messages even if no pending sync found (better to save them).
		msgCount := 0
		for _, hsMsg := range conv.GetMessages() {
			webMsg := hsMsg.GetMessage()
			if webMsg == nil || webMsg.GetKey() == nil {
				continue
			}

			payload := convertHistoryMessage(chatID, webMsg)
			if payload == nil {
				continue
			}

			l.db.SaveMessage(*payload)
			msgCount++
		}

		totalSaved += msgCount
		log.Info().Str("chat_id", chatID).Int("messages", msgCount).Msg("history sync messages saved")

		// Mark the command as completed if we had a pending sync.
		if exists {
			result, _ := json.Marshal(map[string]int{"messages_received": msgCount})
			if err := l.db.MarkCommandCompleted(context.Background(), ps.commandID, result); err != nil {
				log.Error().Err(err).Int64("command_id", ps.commandID).Msg("failed to mark command completed")
			}
		}
	}

	// If the ON_DEMAND response had no conversations matching pending syncs,
	// check if there are orphan pending syncs that might match by prefix.
	// This handles cases where the response chat JID format differs slightly.
	if totalSaved == 0 {
		log.Warn().Msg("ON_DEMAND history sync received but no messages were found")
		// Check all pending syncs and see if any conversations contained messages
		l.mu.Lock()
		for chatKey, ps := range l.pendingSyncs {
			for _, conv := range data.GetConversations() {
				convID := conv.GetID()
				if convID != "" && (convID == chatKey || strings.HasPrefix(convID, chatKey) || strings.HasPrefix(chatKey, convID)) {
					ps.timer.Stop()
					delete(l.pendingSyncs, chatKey)
					result, _ := json.Marshal(map[string]int{"messages_received": 0})
					_ = l.db.MarkCommandCompleted(context.Background(), ps.commandID, result)
					break
				}
			}
		}
		l.mu.Unlock()
	}
}
