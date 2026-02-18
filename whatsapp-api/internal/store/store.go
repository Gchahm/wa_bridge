// Package store handles all database interactions for the WhatsApp bridge.
package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/lib/pq"
)

// Store wraps a *sql.DB and provides bridge-specific persistence operations.
type Store struct {
	db *sql.DB
}

// New opens a Postgres connection, verifies it with a ping, and returns a Store.
// It panics if the connection cannot be established.
func New(databaseURL string) *Store {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		panic(fmt.Sprintf("failed to connect to bridge DB: %v", err))
	}
	if err := db.Ping(); err != nil {
		panic(fmt.Sprintf("failed to ping bridge DB: %v", err))
	}
	fmt.Println("Connected to bridge database")
	return &Store{db: db}
}

// Close closes the underlying database connection.
func (s *Store) Close() error {
	return s.db.Close()
}

// MessagePayload is the canonical representation of a WhatsApp message used
// across the store, messaging, and webhook packages.
type MessagePayload struct {
	Timestamp   time.Time `json:"timestamp"`
	MessageID   string    `json:"message_id"`
	ChatID      string    `json:"chat_id"`
	ChatName    string    `json:"chat_name,omitempty"`
	SenderID    string    `json:"sender_id"`
	SenderName  string    `json:"sender_name,omitempty"`
	MessageType string    `json:"message_type"`
	Text        string    `json:"text,omitempty"`
	MediaType   string    `json:"media_type,omitempty"`
	IsGroup     bool      `json:"is_group"`
	IsFromMe    bool      `json:"is_from_me"`
}

// SaveMessage persists a received message along with its contact and chat records.
// Each operation uses upsert semantics so duplicate events are safe to replay.
func (s *Store) SaveMessage(payload MessagePayload) {
	ctx := context.Background()

	if payload.SenderID != "" {
		_, err := s.db.ExecContext(ctx,
			`INSERT INTO wa_bridge.contacts (phone_number, push_name, last_seen_at)
			 VALUES ($1, $2, now())
			 ON CONFLICT (phone_number) DO UPDATE SET
			   push_name = COALESCE(NULLIF($2, ''), wa_bridge.contacts.push_name),
			   last_seen_at = now()`,
			payload.SenderID, payload.SenderName)
		if err != nil {
			fmt.Printf("Error upserting contact: %v\n", err)
		}
	}

	_, err := s.db.ExecContext(ctx,
		`INSERT INTO wa_bridge.chats (chat_id, is_group, name, last_message_at)
		 VALUES ($1, $2, NULLIF($3, ''), $4)
		 ON CONFLICT (chat_id) DO UPDATE SET
		   name = COALESCE(NULLIF($3, ''), wa_bridge.chats.name),
		   last_message_at = $4`,
		payload.ChatID, payload.IsGroup, payload.ChatName, payload.Timestamp)
	if err != nil {
		fmt.Printf("Error upserting chat: %v\n", err)
		return
	}

	_, err = s.db.ExecContext(ctx,
		`INSERT INTO wa_bridge.messages (message_id, chat_id, sender_id, sender_name, message_type, media_type, content, is_from_me, timestamp)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 ON CONFLICT (message_id, chat_id) DO NOTHING`,
		payload.MessageID, payload.ChatID, payload.SenderID, payload.SenderName,
		payload.MessageType, payload.MediaType, payload.Text, payload.IsFromMe, payload.Timestamp)
	if err != nil {
		fmt.Printf("Error inserting message: %v\n", err)
		return
	}

	fmt.Printf("Message saved to DB: %s from %s\n", payload.MessageID, payload.SenderID)
}

// UpdateMediaPath sets the media_path column on a previously saved message.
func (s *Store) UpdateMediaPath(messageID, chatID, mediaPath string) error {
	_, err := s.db.ExecContext(context.Background(),
		`UPDATE wa_bridge.messages SET media_path = $1 WHERE message_id = $2 AND chat_id = $3`,
		mediaPath, messageID, chatID)
	return err
}

// PendingOutboxIDs returns the IDs of all pending outgoing messages, ordered
// by insertion order so older messages are processed first.
func (s *Store) PendingOutboxIDs(ctx context.Context) ([]int64, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id FROM wa_bridge.outgoing_messages WHERE status = 'pending' ORDER BY id`)
	if err != nil {
		return nil, fmt.Errorf("querying pending outbox: %w", err)
	}
	defer rows.Close()

	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return ids, fmt.Errorf("scanning outbox row: %w", err)
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// ClaimOutboxMessage atomically transitions a pending message to 'sending' and
// returns its chat_id and content. Returns sql.ErrNoRows if the message was
// already claimed or is no longer pending.
func (s *Store) ClaimOutboxMessage(ctx context.Context, id int64) (chatID, content string, err error) {
	err = s.db.QueryRowContext(ctx,
		`UPDATE wa_bridge.outgoing_messages
		 SET status = 'sending'
		 WHERE id = $1 AND status = 'pending'
		 RETURNING chat_id, content`,
		id).Scan(&chatID, &content)
	return chatID, content, err
}

// MarkOutboxSent records the WhatsApp message ID and timestamp on a sent outbox entry.
func (s *Store) MarkOutboxSent(ctx context.Context, id int64, sentMessageID string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE wa_bridge.outgoing_messages
		 SET status = 'sent', sent_message_id = $1, sent_at = now()
		 WHERE id = $2`,
		sentMessageID, id)
	return err
}

// MarkOutboxFailed sets the status of an outbox message to 'failed' and records
// the error description.
func (s *Store) MarkOutboxFailed(ctx context.Context, id int64, errMsg string) {
	_, err := s.db.ExecContext(ctx,
		`UPDATE wa_bridge.outgoing_messages
		 SET status = 'failed', error_message = $1
		 WHERE id = $2`,
		errMsg, id)
	if err != nil {
		fmt.Printf("Error marking outbox message %d as failed: %v\n", id, err)
	}
	fmt.Printf("Outbox message %d failed: %s\n", id, errMsg)
}

// UpsertOwnContact inserts or updates the bridge account's own contact record
// so that foreign-key constraints on wa_bridge.messages are satisfied.
func (s *Store) UpsertOwnContact(ctx context.Context, phoneNumber string) {
	if phoneNumber == "" {
		return
	}
	_, _ = s.db.ExecContext(ctx,
		`INSERT INTO wa_bridge.contacts (phone_number, last_seen_at)
		 VALUES ($1, now())
		 ON CONFLICT (phone_number) DO UPDATE SET last_seen_at = now()`,
		phoneNumber)
}

// InsertSentMessage inserts a just-sent outgoing message into the messages table
// so it appears in the conversation history.
func (s *Store) InsertSentMessage(ctx context.Context, messageID, chatID, senderID, content string, ts time.Time) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO wa_bridge.messages (message_id, chat_id, sender_id, sender_name, message_type, content, is_from_me, timestamp)
		 VALUES ($1, $2, $3, '', 'text', $4, true, $5)
		 ON CONFLICT (message_id, chat_id) DO NOTHING`,
		messageID, chatID, senderID, content, ts)
	return err
}

// UpdateChatLastMessage bumps the last_message_at timestamp on a chat record.
func (s *Store) UpdateChatLastMessage(ctx context.Context, chatID string, ts time.Time) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE wa_bridge.chats SET last_message_at = $1 WHERE chat_id = $2`,
		ts, chatID)
	return err
}
