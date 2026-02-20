// Package webhook forwards WhatsApp messages to external HTTP endpoints.
package webhook

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strconv"

	"whatsapp-bridge/internal/logging"
	"whatsapp-bridge/internal/store"
)

var log = logging.Component("webhook")

// SendText marshals payload as JSON and POSTs it to webhookURL.
func SendText(webhookURL string, payload store.MessagePayload) {
	data, err := json.Marshal(payload)
	if err != nil {
		log.Error().Err(err).Msg("failed to marshal payload")
		return
	}

	resp, err := http.Post(webhookURL, "application/json", bytes.NewBuffer(data))
	if err != nil {
		log.Error().Err(err).Msg("failed to send to webhook")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		log.Debug().
			Str("message_id", payload.MessageID).
			Str("sender_id", payload.SenderID).
			Msg("message forwarded")
	} else {
		log.Warn().
			Int("status_code", resp.StatusCode).
			Str("message_id", payload.MessageID).
			Msg("webhook returned non-2xx status")
	}
}

// SendVoice uploads audioData as a multipart/form-data POST to voiceWebhookURL.
// It sniffs the audio container format to choose the correct filename and
// Content-Type.
func SendVoice(voiceWebhookURL, senderID, senderName, chatID, messageID string, isGroup bool, audioData []byte) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	writer.WriteField("sender_id", senderID)
	writer.WriteField("sender_name", senderName)
	writer.WriteField("chat_id", chatID)
	writer.WriteField("message_id", messageID)
	writer.WriteField("is_group", strconv.FormatBool(isGroup))

	filename := "file.opus"
	contentType := "audio/opus"
	if len(audioData) >= 4 && string(audioData[:4]) == "OggS" {
		filename = "file.oga"
		contentType = "audio/ogg"
	}

	partHeader := make(textproto.MIMEHeader)
	partHeader.Set("Content-Disposition", fmt.Sprintf(`form-data; name="data"; filename="%s"`, filename))
	partHeader.Set("Content-Type", contentType)
	part, err := writer.CreatePart(partHeader)
	if err != nil {
		log.Error().Err(err).Str("message_id", messageID).Msg("failed to create multipart part")
		return
	}
	if _, err := io.Copy(part, bytes.NewReader(audioData)); err != nil {
		log.Error().Err(err).Str("message_id", messageID).Msg("failed to write audio data")
		return
	}
	writer.Close()

	resp, err := http.Post(voiceWebhookURL, writer.FormDataContentType(), &body)
	if err != nil {
		log.Error().Err(err).Str("message_id", messageID).Msg("failed to send to voice webhook")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		log.Debug().
			Str("message_id", messageID).
			Str("sender_id", senderID).
			Msg("audio forwarded")
	} else {
		log.Warn().
			Int("status_code", resp.StatusCode).
			Str("message_id", messageID).
			Msg("voice webhook returned non-2xx status")
	}
}
