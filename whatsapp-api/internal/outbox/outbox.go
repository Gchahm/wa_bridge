// Package outbox implements the LISTEN/NOTIFY outbox pattern for outgoing
// WhatsApp messages. A Postgres channel signals new rows in
// wa_bridge.outgoing_messages; this package claims and sends them.
package outbox

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/lib/pq"
	waProto "go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"

	"go.mau.fi/whatsmeow"

	"whatsapp-bridge/internal/logging"
	"whatsapp-bridge/internal/store"
)

var log = logging.Component("outbox")

// Listen subscribes to the new_outgoing_message Postgres channel and processes
// outgoing messages as they arrive. It also drains any messages that were
// pending before the listener started. Blocks until ctx is cancelled.
func Listen(ctx context.Context, client *whatsmeow.Client, db *store.Store, databaseURL string) {
	reportProblem := func(ev pq.ListenerEventType, err error) {
		if err != nil {
			log.Error().Err(err).Msg("listener error")
		}
	}

	listener := pq.NewListener(databaseURL, 10*time.Second, time.Minute, reportProblem)
	if err := listener.Listen("new_outgoing_message"); err != nil {
		log.Error().Err(err).Msg("failed to LISTEN on new_outgoing_message")
		return
	}
	log.Info().Msg("listening for outgoing messages on new_outgoing_message channel")

	// Drain any messages that arrived before we started listening.
	processPending(ctx, client, db)

	for {
		select {
		case <-ctx.Done():
			listener.Close()
			return
		case n := <-listener.Notify:
			if n == nil {
				// nil notification signals a reconnect — re-drain pending.
				log.Info().Msg("listener reconnected, checking pending messages")
				processPending(ctx, client, db)
				continue
			}
			var payload struct {
				ID int64 `json:"id"`
			}
			if err := json.Unmarshal([]byte(n.Extra), &payload); err != nil {
				log.Error().Err(err).Msg("failed to parse outbox notification")
				continue
			}
			go processOne(ctx, client, db, payload.ID)
		}
	}
}

func processPending(ctx context.Context, client *whatsmeow.Client, db *store.Store) {
	ids, err := db.PendingOutboxIDs(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to query pending outbox")
		return
	}
	for _, id := range ids {
		processOne(ctx, client, db, id)
	}
	if len(ids) > 0 {
		log.Info().Int("count", len(ids)).Msg("processed pending outbox messages")
	}
}

func processOne(ctx context.Context, client *whatsmeow.Client, db *store.Store, id int64) {
	chatID, content, err := db.ClaimOutboxMessage(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			// Already claimed by another instance or no longer pending.
			return
		}
		log.Error().Err(err).Int64("outbox_id", id).Msg("failed to claim outbox message")
		return
	}

	jid, err := types.ParseJID(chatID)
	if err != nil {
		db.MarkOutboxFailed(ctx, id, fmt.Sprintf("invalid chat_id JID: %v", err))
		return
	}

	msg := &waProto.Message{
		Conversation: proto.String(content),
	}
	resp, err := client.SendMessage(ctx, jid, msg)
	if err != nil {
		db.MarkOutboxFailed(ctx, id, fmt.Sprintf("send failed: %v", err))
		return
	}

	if err := db.MarkOutboxSent(ctx, id, resp.ID); err != nil {
		log.Error().Err(err).Int64("outbox_id", id).Str("message_id", resp.ID).Msg("failed to mark outbox message as sent")
	}

	now := time.Now()

	var senderID string
	if client.Store.ID != nil {
		senderID = client.Store.ID.User
	}

	db.UpsertOwnContact(ctx, senderID)

	if err := db.InsertSentMessage(ctx, resp.ID, chatID, senderID, content, now); err != nil {
		log.Error().Err(err).Str("message_id", resp.ID).Str("chat_id", chatID).Msg("failed to insert sent message")
	}

	if err := db.UpdateChatLastMessage(ctx, chatID, now); err != nil {
		log.Error().Err(err).Str("chat_id", chatID).Msg("failed to update chat last_message_at")
	}

	log.Info().
		Int64("outbox_id", id).
		Str("message_id", resp.ID).
		Str("chat_id", chatID).
		Msg("message sent")
}
