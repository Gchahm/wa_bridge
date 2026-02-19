// Package messaging registers the whatsmeow event handler and processes
// incoming WhatsApp messages: parsing, persistence, media upload, and webhook
// forwarding.
package messaging

import (
	"context"
	"fmt"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"

	"whatsapp-bridge/internal/config"
	"whatsapp-bridge/internal/media"
	"whatsapp-bridge/internal/store"
	"whatsapp-bridge/internal/webhook"
)

// RegisterHandler attaches the message event handler to client. All
// configuration and dependencies are provided explicitly so there is no
// reliance on package-level globals.
func RegisterHandler(client *whatsmeow.Client, cfg config.Config, db *store.Store) {
	client.AddEventHandler(func(evt interface{}) {
		fmt.Printf("Event received: %T\n", evt)
		if msg, ok := evt.(*events.Message); ok {
			handleMessage(client, cfg, db, msg)
		}
	})
}

func handleMessage(client *whatsmeow.Client, cfg config.Config, db *store.Store, msg *events.Message) {
	payload := buildPayload(msg)
	payload.ChatName = resolveChatName(client, msg)

	go db.SaveMessage(payload)

	if payload.MessageType == "media" && cfg.StorageConfigured() {
		go handleMediaUpload(client, cfg, db, msg, payload)
	} else if payload.MediaType == "audio" && cfg.VoiceWebhookURL != "" {
		// Backward compatibility: forward audio to voice webhook when storage is
		// not configured.
		audioData, err := client.Download(context.Background(), msg.Message.AudioMessage)
		if err != nil {
			fmt.Printf("Error downloading audio: %v\n", err)
		} else {
			go webhook.SendVoice(cfg.VoiceWebhookURL,
				payload.SenderID, payload.SenderName, payload.ChatID,
				payload.MessageID, payload.IsGroup, audioData)
		}
	}

	if cfg.WebhookURL != "" {
		go webhook.SendText(cfg.WebhookURL, payload)
	}
}

// resolveChatName returns a human-friendly name for the chat. For groups it
// fetches the group subject via the WhatsApp API; for DMs it uses the other
// party's push name.
func resolveChatName(client *whatsmeow.Client, msg *events.Message) string {
	if msg.Info.IsGroup {
		info, err := client.GetGroupInfo(context.Background(), msg.Info.Chat)
		if err != nil {
			fmt.Printf("Error fetching group info for %s: %v\n", msg.Info.Chat, err)
			return ""
		}
		return info.Name
	}
	// For DMs, use the sender's push name (only meaningful for incoming messages).
	if !msg.Info.IsFromMe {
		return msg.Info.PushName
	}
	return ""
}

// buildPayload derives a MessagePayload from the raw whatsmeow event.
func buildPayload(msg *events.Message) store.MessagePayload {
	var sender string
	switch msg.Info.Chat.Server {
	case types.HiddenUserServer:
		sender = msg.Info.MessageSource.SenderAlt.User
	case types.GroupServer:
		sender = msg.Info.MessageSource.Chat.User
	default:
		sender = msg.Info.Sender.User
	}

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
	default:
		payload.MessageType = "other"
	}

	return payload
}

// handleMediaUpload downloads the attachment and uploads it to Supabase
// Storage, then updates the message record with the resulting path.
// For audio messages it also forwards to the voice webhook.
func handleMediaUpload(client *whatsmeow.Client, cfg config.Config, db *store.Store, msg *events.Message, payload store.MessagePayload) {
	info := media.FromMessage(msg)
	if info == nil {
		return
	}

	data, err := client.Download(context.Background(), info.Downloadable)
	if err != nil {
		fmt.Printf("Error downloading media %s: %v\n", payload.MessageID, err)
		return
	}

	if payload.MediaType == "audio" && cfg.VoiceWebhookURL != "" {
		go webhook.SendVoice(cfg.VoiceWebhookURL,
			payload.SenderID, payload.SenderName, payload.ChatID,
			payload.MessageID, payload.IsGroup, data)
	}

	ext := media.MimeToExt(info.MimeType)
	mediaPath := fmt.Sprintf("%s/%s.%s", payload.ChatID, payload.MessageID, ext)

	if err := media.UploadToSupabase(data, cfg.SupabaseURL, cfg.SupabaseServiceKey, "wa-media", mediaPath, info.MimeType); err != nil {
		fmt.Printf("Error uploading media %s: %v\n", payload.MessageID, err)
		return
	}

	if err := db.UpdateMediaPath(payload.MessageID, payload.ChatID, mediaPath); err != nil {
		fmt.Printf("Error updating media_path %s: %v\n", payload.MessageID, err)
		return
	}

	fmt.Printf("Media stored: %s\n", mediaPath)
}
