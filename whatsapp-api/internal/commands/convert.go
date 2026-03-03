package commands

import (
	"strings"
	"time"

	"go.mau.fi/whatsmeow/proto/waWeb"

	"whatsapp-bridge/internal/store"
)

// convertHistoryMessage converts a whatsmeow WebMessageInfo (from a history
// sync response) into a store.MessagePayload. Returns nil if the message
// should be skipped (no useful content).
func convertHistoryMessage(chatID string, webMsg *waWeb.WebMessageInfo) *store.MessagePayload {
	key := webMsg.GetKey()
	if key == nil || key.GetID() == "" {
		return nil
	}

	msg := webMsg.GetMessage()
	if msg == nil {
		return nil
	}

	isFromMe := key.GetFromMe()
	isGroup := strings.HasSuffix(chatID, "@g.us")

	// Determine sender.
	var senderID string
	if isGroup {
		// In groups, participant contains the sender JID.
		if p := webMsg.GetParticipant(); p != "" {
			senderID = extractUser(p)
		} else if key.GetParticipant() != "" {
			senderID = extractUser(key.GetParticipant())
		}
	} else if !isFromMe {
		// In 1:1 chats, the sender is the remote JID.
		senderID = extractUser(chatID)
	}

	ts := time.Unix(int64(webMsg.GetMessageTimestamp()), 0)
	pushName := webMsg.GetPushName()

	payload := store.MessagePayload{
		Timestamp:   ts,
		MessageID:   key.GetID(),
		ChatID:      chatID,
		SenderID:    senderID,
		SenderName:  pushName,
		IsGroup:     isGroup,
		IsFromMe:    isFromMe,
	}

	// Extract content following the same switch/case as messaging/handler.go:buildPayload()
	switch {
	case msg.GetConversation() != "":
		payload.MessageType = "text"
		payload.Text = msg.GetConversation()
	case msg.ExtendedTextMessage != nil:
		payload.MessageType = "text"
		payload.Text = msg.ExtendedTextMessage.GetText()
		payload.ReplyToMessageID = msg.ExtendedTextMessage.GetContextInfo().GetStanzaID()
	case msg.ImageMessage != nil:
		payload.MessageType = "media"
		payload.MediaType = "image"
		payload.Text = msg.ImageMessage.GetCaption()
		payload.ReplyToMessageID = msg.ImageMessage.GetContextInfo().GetStanzaID()
	case msg.VideoMessage != nil:
		payload.MessageType = "media"
		payload.MediaType = "video"
		payload.Text = msg.VideoMessage.GetCaption()
		payload.ReplyToMessageID = msg.VideoMessage.GetContextInfo().GetStanzaID()
	case msg.AudioMessage != nil:
		payload.MessageType = "media"
		payload.MediaType = "audio"
		payload.ReplyToMessageID = msg.AudioMessage.GetContextInfo().GetStanzaID()
	case msg.DocumentMessage != nil:
		payload.MessageType = "media"
		payload.MediaType = "document"
		payload.Text = msg.DocumentMessage.GetCaption()
		payload.ReplyToMessageID = msg.DocumentMessage.GetContextInfo().GetStanzaID()
	case msg.StickerMessage != nil:
		payload.MessageType = "media"
		payload.MediaType = "sticker"
		payload.ReplyToMessageID = msg.StickerMessage.GetContextInfo().GetStanzaID()
	case msg.ContactMessage != nil:
		payload.MessageType = "contact"
		payload.Text = msg.ContactMessage.GetDisplayName()
	case msg.ContactsArrayMessage != nil:
		payload.MessageType = "contact"
		names := make([]string, 0, len(msg.ContactsArrayMessage.GetContacts()))
		for _, c := range msg.ContactsArrayMessage.GetContacts() {
			names = append(names, c.GetDisplayName())
		}
		payload.Text = strings.Join(names, ", ")
	default:
		// Skip protocol messages, sender key distributions, etc.
		// These are internal events, not user-visible content.
		if msg.GetProtocolMessage() != nil || msg.GetSenderKeyDistributionMessage() != nil {
			return nil
		}
		payload.MessageType = "other"
	}

	return &payload
}

// extractUser extracts the user portion from a JID string (before the @).
func extractUser(jid string) string {
	if idx := strings.IndexByte(jid, '@'); idx > 0 {
		return jid[:idx]
	}
	return jid
}
