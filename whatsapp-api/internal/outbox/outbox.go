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

	"whatsapp-bridge/internal/store"
)

// Listen subscribes to the new_outgoing_message Postgres channel and processes
// outgoing messages as they arrive. It also drains any messages that were
// pending before the listener started. Blocks until ctx is cancelled.
func Listen(ctx context.Context, client *whatsmeow.Client, db *store.Store, databaseURL string) {
	reportProblem := func(ev pq.ListenerEventType, err error) {
		if err != nil {
			fmt.Printf("Outbox listener error: %v\n", err)
		}
	}

	listener := pq.NewListener(databaseURL, 10*time.Second, time.Minute, reportProblem)
	if err := listener.Listen("new_outgoing_message"); err != nil {
		fmt.Printf("Failed to LISTEN on new_outgoing_message: %v\n", err)
		return
	}
	fmt.Println("Listening for outgoing messages on new_outgoing_message channel")

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
				fmt.Println("Outbox listener reconnected, checking pending messages")
				processPending(ctx, client, db)
				continue
			}
			var payload struct {
				ID int64 `json:"id"`
			}
			if err := json.Unmarshal([]byte(n.Extra), &payload); err != nil {
				fmt.Printf("Error parsing outbox notification: %v\n", err)
				continue
			}
			go processOne(ctx, client, db, payload.ID)
		}
	}
}

func processPending(ctx context.Context, client *whatsmeow.Client, db *store.Store) {
	ids, err := db.PendingOutboxIDs(ctx)
	if err != nil {
		fmt.Printf("Error querying pending outbox: %v\n", err)
		return
	}
	for _, id := range ids {
		processOne(ctx, client, db, id)
	}
	if len(ids) > 0 {
		fmt.Printf("Processed %d pending outbox messages\n", len(ids))
	}
}

func processOne(ctx context.Context, client *whatsmeow.Client, db *store.Store, id int64) {
	chatID, content, err := db.ClaimOutboxMessage(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			// Already claimed by another instance or no longer pending.
			return
		}
		fmt.Printf("Error claiming outbox message %d: %v\n", id, err)
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
		fmt.Printf("Error marking outbox message %d as sent: %v\n", id, err)
	}

	now := time.Now()

	var senderID string
	if client.Store.ID != nil {
		senderID = client.Store.ID.User
	}

	db.UpsertOwnContact(ctx, senderID)

	if err := db.InsertSentMessage(ctx, resp.ID, chatID, senderID, content, now); err != nil {
		fmt.Printf("Error inserting sent message %s: %v\n", resp.ID, err)
	}

	if err := db.UpdateChatLastMessage(ctx, chatID, now); err != nil {
		fmt.Printf("Error updating chat last_message_at for %s: %v\n", chatID, err)
	}

	fmt.Printf("Outbox message %d sent as %s to %s\n", id, resp.ID, chatID)
}
