package messaging

import (
	"context"
	"encoding/json"
	"time"

	"github.com/lib/pq"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"

	"whatsapp-bridge/internal/store"
)

// ListenGroupChats subscribes to the new_group_chat Postgres channel and
// resolves group names via the WhatsApp API when new group chat rows are
// created. It also drains any groups with missing names on startup and
// reconnect. Blocks until ctx is cancelled.
func ListenGroupChats(ctx context.Context, client *whatsmeow.Client, db *store.Store, databaseURL string) {
	reportProblem := func(ev pq.ListenerEventType, err error) {
		if err != nil {
			log.Error().Err(err).Msg("group chat listener error")
		}
	}

	listener := pq.NewListener(databaseURL, 10*time.Second, time.Minute, reportProblem)
	if err := listener.Listen("new_group_chat"); err != nil {
		log.Error().Err(err).Msg("failed to LISTEN on new_group_chat")
		return
	}
	log.Info().Msg("listening for new group chats on new_group_chat channel")

	// Drain any groups created while the bridge was offline.
	resolvePendingGroupNames(ctx, client, db)

	for {
		select {
		case <-ctx.Done():
			listener.Close()
			return
		case n := <-listener.Notify:
			if n == nil {
				// nil notification signals a reconnect — re-drain pending.
				log.Info().Msg("group chat listener reconnected, resolving pending group names")
				resolvePendingGroupNames(ctx, client, db)
				continue
			}
			var payload struct {
				ChatID string `json:"chat_id"`
			}
			if err := json.Unmarshal([]byte(n.Extra), &payload); err != nil {
				log.Error().Err(err).Msg("failed to parse new_group_chat notification")
				continue
			}
			go resolveGroupName(ctx, client, db, payload.ChatID)
		}
	}
}

// resolveGroupName fetches the group name from WhatsApp and updates the chat record.
func resolveGroupName(ctx context.Context, client *whatsmeow.Client, db *store.Store, chatID string) {
	jid, err := types.ParseJID(chatID)
	if err != nil {
		log.Error().Err(err).Str("chat_id", chatID).Msg("invalid JID for group name resolution")
		return
	}

	info, err := client.GetGroupInfo(ctx, jid)
	if err != nil {
		log.Error().Err(err).Str("chat_id", chatID).Msg("failed to fetch group info")
		return
	}

	if err := db.UpdateChatName(ctx, chatID, info.Name); err != nil {
		log.Error().Err(err).Str("chat_id", chatID).Msg("failed to update group chat name")
		return
	}

	log.Debug().Str("chat_id", chatID).Str("name", info.Name).Msg("group name resolved")
}

// resolvePendingGroupNames finds all group chats without a name and resolves
// them. This handles groups created while the bridge was offline.
func resolvePendingGroupNames(ctx context.Context, client *whatsmeow.Client, db *store.Store) {
	chatIDs, err := db.GroupChatsWithoutName(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to query group chats without name")
		return
	}
	for _, chatID := range chatIDs {
		resolveGroupName(ctx, client, db, chatID)
	}
	if len(chatIDs) > 0 {
		log.Info().Int("count", len(chatIDs)).Msg("resolved pending group names")
	}
}
