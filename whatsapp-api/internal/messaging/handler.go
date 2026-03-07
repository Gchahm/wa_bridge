// Package messaging registers the whatsmeow event handler and processes
// incoming WhatsApp messages: parsing, persistence, media download, storage
// upload, and webhook forwarding.
package messaging

import (
	"context"
	"fmt"
	"strings"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/encoding/protojson"

	"whatsapp-bridge/internal/agent"
	"whatsapp-bridge/internal/commands"
	"whatsapp-bridge/internal/config"
	"whatsapp-bridge/internal/logging"
	"whatsapp-bridge/internal/media"
	"whatsapp-bridge/internal/metrics"
	"whatsapp-bridge/internal/store"
	"whatsapp-bridge/internal/webhook"
)

var log = logging.Component("messaging")

// RegisterHandler attaches the message event handler to client. All
// configuration and dependencies are provided explicitly so there is no
// reliance on package-level globals.
func RegisterHandler(client *whatsmeow.Client, cfg config.Config, db *store.Store, agentHandler *agent.Handler, cmdListener *commands.Listener) {
	client.AddEventHandler(func(evt interface{}) {
		log.Debug().Str("type", fmt.Sprintf("%T", evt)).Msg("event received")
		switch v := evt.(type) {
		case *events.Message:
			go handleMessage(client, cfg, db, agentHandler, v)
		case *events.HistorySync:
			if cmdListener != nil {
				go cmdListener.HandleHistorySyncEvent(v)
			}
		}
	})
}

func handleMessage(client *whatsmeow.Client, cfg config.Config, db *store.Store, agentHandler *agent.Handler, msg *events.Message) {
	start := time.Now()

	// Handle reactions separately — they are not regular messages.
	if reaction := msg.Message.GetReactionMessage(); reaction != nil {
		go handleReaction(client, db, msg, reaction)
		return
	}

	// Skip sender key distribution messages that carry no user-visible content.
	// These are internal Signal protocol key rotation events that sometimes
	// piggyback on real messages. Only skip when no actual content is present.
	if msg.Message.GetSenderKeyDistributionMessage() != nil && !hasUserContent(msg) {
		log.Debug().Str("message_id", msg.Info.ID).Msg("skipping sender key distribution (no user content)")
		return
	}

	// Skip album messages — they are grouping metadata only. The actual
	// images/videos arrive as separate events that are already handled.
	if msg.Message.GetAlbumMessage() != nil {
		log.Debug().Str("message_id", msg.Info.ID).Msg("skipping album message (media arrives separately)")
		return
	}

	// Skip group messages when configured to do so.
	if cfg.IgnoreGroupMessages && msg.Info.IsGroup {
		log.Debug().Str("message_id", msg.Info.ID).Str("chat_id", msg.Info.Chat.String()).Msg("skipping group message (IGNORE_GROUP_MESSAGES=true)")
		return
	}

	// Handle protocol messages (edits, revocations, etc.) before building
	// the regular payload. These are not user-visible content rows.
	if proto := msg.Message.GetProtocolMessage(); proto != nil {
		if proto.GetType() == waE2E.ProtocolMessage_MESSAGE_EDIT {
			go handleMessageEdit(client, db, msg, proto)
		}
		return
	}

	payload := buildPayload(msg)
	// Normalize @lid chat IDs to phone-number format so all messages
	// for the same conversation share a single chat_id.
	resolved := resolveChatJID(client, msg.Info.Chat)
	payload.ChatID = resolved.String()

	if !msg.Info.IsGroup && !msg.Info.IsFromMe {
		payload.ChatName = msg.Info.PushName
	}

	isGroup := "false"
	if payload.IsGroup {
		isGroup = "true"
	}

	if payload.MessageType == "other" {
		go func() {
			db.SaveMessage(payload)
			rawJSON, err := protojson.Marshal(msg.Message)
			if err != nil {
				log.Error().Err(err).Str("message_id", payload.MessageID).Msg("failed to marshal message proto")
				return
			}
			if err := db.UpdateDescription(payload.MessageID, payload.ChatID, string(rawJSON)); err != nil {
				log.Error().Err(err).Str("message_id", payload.MessageID).Msg("failed to update description for unknown message type")
			}
		}()
	} else if !payload.IsGroup && !payload.IsFromMe && payload.MessageType != "other" {
		// Save synchronously so the message is available when the agent reads history.
		db.SaveMessage(payload)
		// Trigger agent if active for this chat.
		if agentHandler != nil {
			active, err := db.IsAgentActive(context.Background(), payload.ChatID)
			if err != nil {
				log.Error().Err(err).Str("chat_id", payload.ChatID).Msg("failed to check agent_active")
			} else if active {
				go agentHandler.HandleMessage(context.Background(), agent.Request{ChatID: payload.ChatID})
			}
		}
	} else {
		go db.SaveMessage(payload)
	}

	if payload.MessageType == "media" {
		go handleMedia(client, cfg, db, msg, payload)
	}

	if cfg.WebhookURL != "" && !(payload.MessageType == "media" && payload.Text == "") {
		go webhook.SendText(cfg.WebhookURL, payload)
	}

	metrics.IncomingMessageTotal.WithLabelValues(payload.MessageType, isGroup).Inc()
	metrics.IncomingMessageDuration.WithLabelValues(payload.MessageType).Observe(time.Since(start).Seconds())
}

// resolveChatJID normalises @lid (Linked Identity) JIDs to the corresponding
// @s.whatsapp.net phone-number JID so that messages from the primary device
// and companion devices all share a single chat_id.
func resolveChatJID(client *whatsmeow.Client, chatJID types.JID) types.JID {
	if chatJID.Server != types.HiddenUserServer {
		return chatJID
	}
	pnJID, err := client.Store.LIDs.GetPNForLID(context.Background(), chatJID)
	if err != nil || pnJID.IsEmpty() {
		return chatJID
	}
	return pnJID
}

// resolveSender extracts the sender phone number from the message metadata.
func resolveSender(msg *events.Message) string {
	switch msg.Info.Chat.Server {
	case types.HiddenUserServer:
		return msg.Info.MessageSource.SenderAlt.User
	case types.GroupServer:
		return msg.Info.MessageSource.Chat.User
	default:
		return msg.Info.Sender.User
	}
}

// hasUserContent reports whether the message contains any user-visible content
// (text, media, or other recognized message types) beyond protocol-level
// metadata like SenderKeyDistributionMessage and MessageContextInfo.
func hasUserContent(msg *events.Message) bool {
	m := msg.Message
	return m.GetConversation() != "" ||
		m.ExtendedTextMessage != nil ||
		m.ImageMessage != nil ||
		m.VideoMessage != nil ||
		m.AudioMessage != nil ||
		m.DocumentMessage != nil ||
		m.StickerMessage != nil ||
		m.ContactMessage != nil ||
		m.ContactsArrayMessage != nil ||
		m.ReactionMessage != nil ||
		m.ProtocolMessage != nil
}

// buildPayload derives a MessagePayload from the raw whatsmeow event.
func buildPayload(msg *events.Message) store.MessagePayload {
	sender := resolveSender(msg)

	payload := store.MessagePayload{
		Timestamp:  msg.Info.Timestamp,
		MessageID:  msg.Info.ID,
		ChatID:     msg.Info.Chat.String(),
		SenderID:   sender,
		SenderName: msg.Info.PushName,
		IsGroup:    msg.Info.IsGroup,
		IsFromMe:   msg.Info.IsFromMe,
	}

	switch {
	case msg.Message.GetConversation() != "":
		payload.MessageType = "text"
		payload.Text = msg.Message.GetConversation()
	case msg.Message.ExtendedTextMessage != nil:
		payload.MessageType = "text"
		payload.Text = msg.Message.ExtendedTextMessage.GetText()
		payload.ReplyToMessageID = msg.Message.ExtendedTextMessage.GetContextInfo().GetStanzaID()
	case msg.Message.ImageMessage != nil:
		payload.MessageType = "media"
		payload.MediaType = "image"
		payload.Text = msg.Message.ImageMessage.GetCaption()
		payload.ReplyToMessageID = msg.Message.ImageMessage.GetContextInfo().GetStanzaID()
	case msg.Message.VideoMessage != nil:
		payload.MessageType = "media"
		payload.MediaType = "video"
		payload.Text = msg.Message.VideoMessage.GetCaption()
		payload.ReplyToMessageID = msg.Message.VideoMessage.GetContextInfo().GetStanzaID()
	case msg.Message.AudioMessage != nil:
		payload.MessageType = "media"
		payload.MediaType = "audio"
		payload.ReplyToMessageID = msg.Message.AudioMessage.GetContextInfo().GetStanzaID()
	case msg.Message.DocumentMessage != nil:
		payload.MessageType = "media"
		payload.MediaType = "document"
		payload.Text = msg.Message.DocumentMessage.GetCaption()
		payload.ReplyToMessageID = msg.Message.DocumentMessage.GetContextInfo().GetStanzaID()
	case msg.Message.StickerMessage != nil:
		payload.MessageType = "media"
		payload.MediaType = "sticker"
		payload.ReplyToMessageID = msg.Message.StickerMessage.GetContextInfo().GetStanzaID()
	case msg.Message.ContactMessage != nil:
		payload.MessageType = "contact"
		payload.Text = msg.Message.ContactMessage.GetDisplayName()
	case msg.Message.ContactsArrayMessage != nil:
		payload.MessageType = "contact"
		names := make([]string, 0, len(msg.Message.ContactsArrayMessage.GetContacts()))
		for _, c := range msg.Message.ContactsArrayMessage.GetContacts() {
			names = append(names, c.GetDisplayName())
		}
		payload.Text = strings.Join(names, ", ")
	default:
		payload.MessageType = "other"
	}

	return payload
}

// handleReaction persists or removes a WhatsApp reaction. An empty emoji in
// the reaction event means the user retracted their reaction.
func handleReaction(client *whatsmeow.Client, db *store.Store, msg *events.Message, reaction *waE2E.ReactionMessage) {
	targetID := reaction.GetKey().GetID()
	if targetID == "" {
		log.Warn().Msg("reaction has no target message ID")
		return
	}

	// The reaction key contains the target message's JID. Fall back to the
	// event's chat when the key does not carry a remote JID.
	chatID := resolveChatJID(client, msg.Info.Chat).String()
	if reaction.GetKey().GetRemoteJID() != "" {
		chatID = reaction.GetKey().GetRemoteJID()
	}

	senderID := resolveSender(msg)
	senderName := msg.Info.PushName

	ctx := context.Background()

	// Empty emoji text means the user retracted their reaction.
	if reaction.GetText() == "" {
		if err := db.DeleteReaction(ctx, targetID, chatID, senderID); err != nil {
			log.Error().Err(err).Str("target_message_id", targetID).Msg("failed to delete reaction")
		} else {
			log.Debug().Str("target_message_id", targetID).Str("sender_id", senderID).Msg("reaction removed")
		}
		return
	}

	ts := msg.Info.Timestamp
	if err := db.UpsertReaction(ctx, targetID, chatID, senderID, senderName, reaction.GetText(), ts); err != nil {
		log.Error().Err(err).Str("target_message_id", targetID).Str("emoji", reaction.GetText()).Msg("failed to upsert reaction")
	} else {
		log.Debug().Str("target_message_id", targetID).Str("emoji", reaction.GetText()).Str("sender_id", senderID).Msg("reaction saved")
	}
}

// handleMessageEdit processes a MESSAGE_EDIT protocol message by extracting
// the new content and applying it to the original message with edit history.
func handleMessageEdit(client *whatsmeow.Client, db *store.Store, msg *events.Message, proto *waE2E.ProtocolMessage) {
	targetID := proto.GetKey().GetID()
	if targetID == "" {
		log.Warn().Msg("edit protocol message has no target message ID")
		return
	}

	chatID := resolveChatJID(client, msg.Info.Chat).String()
	if proto.GetKey().GetRemoteJID() != "" {
		chatID = proto.GetKey().GetRemoteJID()
	}

	edited := proto.GetEditedMessage()
	if edited == nil {
		log.Warn().Str("target_message_id", targetID).Msg("edit protocol message has no edited message")
		return
	}

	// Extract new content using the same priority as buildPayload.
	var newContent string
	switch {
	case edited.GetConversation() != "":
		newContent = edited.GetConversation()
	case edited.ExtendedTextMessage != nil:
		newContent = edited.ExtendedTextMessage.GetText()
	case edited.ImageMessage != nil:
		newContent = edited.ImageMessage.GetCaption()
	case edited.VideoMessage != nil:
		newContent = edited.VideoMessage.GetCaption()
	case edited.DocumentMessage != nil:
		newContent = edited.DocumentMessage.GetCaption()
	}

	editedAt := msg.Info.Timestamp
	if tsMS := proto.GetTimestampMS(); tsMS > 0 {
		editedAt = time.UnixMilli(tsMS)
	}

	ctx := context.Background()
	if err := db.ApplyMessageEdit(ctx, targetID, chatID, newContent, editedAt); err != nil {
		log.Error().Err(err).Str("target_message_id", targetID).Msg("failed to apply message edit")
	} else {
		log.Debug().Str("target_message_id", targetID).Msg("message edit applied")
	}
}

// handleMedia downloads the attachment, forwards it to the appropriate webhook
// (voice or image), and — when storage is configured — uploads it to Supabase
// Storage and updates the message record with the resulting path.
func handleMedia(client *whatsmeow.Client, cfg config.Config, db *store.Store, msg *events.Message, payload store.MessagePayload) {
	pipelineStart := time.Now()

	info := media.FromMessage(msg)
	if info == nil {
		return
	}

	dlStart := time.Now()
	data, err := client.Download(context.Background(), info.Downloadable)
	metrics.MediaDownloadDuration.WithLabelValues(payload.MediaType).Observe(time.Since(dlStart).Seconds())
	if err != nil {
		log.Error().Err(err).Str("message_id", payload.MessageID).Msg("failed to download media")
		return
	}

	// Forward to voice webhook if audio.
	if payload.MediaType == "audio" && cfg.VoiceWebhookURL != "" {
		go webhook.SendVoice(cfg.VoiceWebhookURL,
			payload.SenderID, payload.SenderName, payload.ChatID,
			payload.MessageID, payload.IsGroup, data)
	}

	// Forward to image webhook if image.
	if payload.MediaType == "image" && cfg.ImageWebhookURL != "" {
		go webhook.SendImage(cfg.ImageWebhookURL,
			payload.SenderID, payload.SenderName, payload.ChatID,
			payload.MessageID, payload.IsGroup, data, info.MimeType)
	}

	// Upload to storage if configured.
	if cfg.StorageConfigured() {
		ext := media.MimeToExt(info.MimeType)
		mediaPath := fmt.Sprintf("%s/%s.%s", payload.ChatID, payload.MessageID, ext)

		ulStart := time.Now()
		if err := media.UploadToSupabase(data, cfg.SupabaseURL, cfg.SupabaseServiceKey, "wa-media", mediaPath, info.MimeType); err != nil {
			metrics.MediaUploadDuration.Observe(time.Since(ulStart).Seconds())
			log.Error().Err(err).Str("message_id", payload.MessageID).Str("media_path", mediaPath).Msg("failed to upload media")
			return
		}
		metrics.MediaUploadDuration.Observe(time.Since(ulStart).Seconds())

		if err := db.UpdateMediaPath(payload.MessageID, payload.ChatID, mediaPath); err != nil {
			log.Error().Err(err).Str("message_id", payload.MessageID).Str("media_path", mediaPath).Msg("failed to update media_path")
			return
		}

		log.Debug().Str("media_path", mediaPath).Msg("media stored")
	}

	metrics.MediaPipelineDuration.WithLabelValues(payload.MediaType).Observe(time.Since(pipelineStart).Seconds())
}
