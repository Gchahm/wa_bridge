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

	"whatsapp-bridge/internal/store"
)

// SendText marshals payload as JSON and POSTs it to webhookURL.
func SendText(webhookURL string, payload store.MessagePayload) {
	data, err := json.Marshal(payload)
	if err != nil {
		fmt.Printf("Error marshaling payload: %v\n", err)
		return
	}

	resp, err := http.Post(webhookURL, "application/json", bytes.NewBuffer(data))
	if err != nil {
		fmt.Printf("Error sending to webhook: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		fmt.Printf("Message forwarded: %s from %s\n", payload.MessageID, payload.SenderID)
	} else {
		fmt.Printf("Webhook returned status: %d\n", resp.StatusCode)
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
		fmt.Printf("Error creating multipart part: %v\n", err)
		return
	}
	if _, err := io.Copy(part, bytes.NewReader(audioData)); err != nil {
		fmt.Printf("Error writing audio data: %v\n", err)
		return
	}
	writer.Close()

	resp, err := http.Post(voiceWebhookURL, writer.FormDataContentType(), &body)
	if err != nil {
		fmt.Printf("Error sending to voice webhook: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		fmt.Printf("Audio forwarded: %s from %s\n", messageID, senderID)
	} else {
		fmt.Printf("Voice webhook returned status: %d\n", resp.StatusCode)
	}
}
