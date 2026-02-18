// Package media handles downloading WhatsApp media attachments and uploading
// them to Supabase Storage.
package media

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types/events"
)

// Info bundles the downloadable handle and MIME type for a media message.
type Info struct {
	Downloadable whatsmeow.DownloadableMessage
	MimeType     string
}

// FromMessage extracts media information from a WhatsApp message event.
// Returns nil when the message contains no media attachment.
func FromMessage(msg *events.Message) *Info {
	if img := msg.Message.GetImageMessage(); img != nil {
		return &Info{Downloadable: img, MimeType: img.GetMimetype()}
	}
	if vid := msg.Message.GetVideoMessage(); vid != nil {
		return &Info{Downloadable: vid, MimeType: vid.GetMimetype()}
	}
	if aud := msg.Message.GetAudioMessage(); aud != nil {
		return &Info{Downloadable: aud, MimeType: aud.GetMimetype()}
	}
	if doc := msg.Message.GetDocumentMessage(); doc != nil {
		return &Info{Downloadable: doc, MimeType: doc.GetMimetype()}
	}
	return nil
}

// MimeToExt converts a MIME type string to a file extension (without the dot).
func MimeToExt(mimeType string) string {
	base := strings.Split(mimeType, ";")[0]
	switch base {
	case "image/jpeg":
		return "jpg"
	case "image/png":
		return "png"
	case "image/webp":
		return "webp"
	case "image/gif":
		return "gif"
	case "video/mp4":
		return "mp4"
	case "video/3gpp":
		return "3gp"
	case "audio/ogg", "audio/ogg; codecs=opus":
		return "ogg"
	case "audio/mpeg":
		return "mp3"
	case "audio/mp4":
		return "m4a"
	case "application/pdf":
		return "pdf"
	case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		return "docx"
	case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
		return "xlsx"
	default:
		return "bin"
	}
}

// UploadToSupabase uploads data to a Supabase Storage bucket at the given
// object path. It uses the service-role key for authorization.
func UploadToSupabase(data []byte, supabaseURL, serviceKey, bucket, path, mimeType string) error {
	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", supabaseURL, bucket, path)
	req, err := http.NewRequest("POST", url, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+serviceKey)
	req.Header.Set("Content-Type", mimeType)
	req.Header.Set("x-upsert", "true")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("uploading: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("storage returned %d: %s", resp.StatusCode, string(body))
	}
	return nil
}
