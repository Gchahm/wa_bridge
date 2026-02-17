package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	_ "github.com/lib/pq"
	"github.com/mdp/qrterminal/v3"
	"github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
)

type MessagePayload struct {
	Timestamp   time.Time `json:"timestamp"`
	MessageID   string    `json:"message_id"`
	ChatID      string    `json:"chat_id"`
	SenderID    string    `json:"sender_id"`
	SenderName  string    `json:"sender_name,omitempty"`
	MessageType string    `json:"message_type"`
	Text        string    `json:"text,omitempty"`
	MediaType   string    `json:"media_type,omitempty"`
	IsGroup     bool      `json:"is_group"`
	IsFromMe    bool      `json:"is_from_me"`
}

type SendRequest struct {
	Number  string `json:"number"`
	Text    string `json:"text"`
	IsGroup bool   `json:"is_group"`
}

var (
	webhookURL         string
	voiceWebhookURL    string
	supabaseURL        string
	supabaseServiceKey string
	listenAddr         string
	databaseURL     string
	currentQRCode   string
	qrMutex         sync.RWMutex
	waClient        *whatsmeow.Client
	bridgeDB        *sql.DB
)

func main() {
	loadConfig()

	ctx := context.Background()
	waClient = newClient(ctx)
	bridgeDB = newBridgeDB()

	registerMessageHandler(waClient)
	startHTTPServer(ctx, waClient)
	go startClient(ctx, waClient)

	fmt.Println("WhatsApp bridge running. Press Ctrl+C to quit.")
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	<-c
	waClient.Disconnect()
	bridgeDB.Close()
}

func loadConfig() {
	webhookURL = os.Getenv("MESSAGE_WEBHOOK_URL")
	voiceWebhookURL = os.Getenv("VOICE_WEBHOOK_URL")
	supabaseURL = os.Getenv("SUPABASE_URL")
	supabaseServiceKey = os.Getenv("SUPABASE_SERVICE_KEY")
	listenAddr = os.Getenv("LISTEN_ADDR")

	databaseURL = os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		panic("DATABASE_URL is required")
	}

	if listenAddr == "" {
		listenAddr = ":8080"
	}
	if webhookURL == "" {
		fmt.Println("Warning: WEBHOOK_URL not set, incoming messages won't be forwarded")
	}
	if voiceWebhookURL == "" {
		fmt.Println("Warning: VOICE_WEBHOOK_URL not set, audio messages won't be forwarded")
	}
}

func newClient(ctx context.Context) *whatsmeow.Client {
	dbLog := waLog.Stdout("Database", "WARN", true)
	container, err := sqlstore.New(ctx, "postgres", databaseURL, dbLog)
	if err != nil {
		panic(err)
	}
	deviceStore, err := container.GetFirstDevice(ctx)
	if err != nil {
		panic(err)
	}
	clientLog := waLog.Stdout("Client", "INFO", true)
	return whatsmeow.NewClient(deviceStore, clientLog)
}

func newBridgeDB() *sql.DB {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		panic(fmt.Sprintf("Failed to connect to bridge DB: %v", err))
	}
	if err := db.Ping(); err != nil {
		panic(fmt.Sprintf("Failed to ping bridge DB: %v", err))
	}
	fmt.Println("Connected to bridge database")
	return db
}

func saveMessageToDB(payload MessagePayload) {
	ctx := context.Background()

	// Upsert contact
	if payload.SenderID != "" {
		_, err := bridgeDB.ExecContext(ctx,
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

	// Upsert chat
	_, err := bridgeDB.ExecContext(ctx,
		`INSERT INTO wa_bridge.chats (chat_id, is_group, last_message_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (chat_id) DO UPDATE SET
		   last_message_at = $3`,
		payload.ChatID, payload.IsGroup, payload.Timestamp)
	if err != nil {
		fmt.Printf("Error upserting chat: %v\n", err)
		return
	}

	// Insert message
	_, err = bridgeDB.ExecContext(ctx,
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

func storageConfigured() bool {
	return supabaseURL != "" && supabaseServiceKey != ""
}

func mimeToExt(mimeType string) string {
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

type mediaInfo struct {
	downloadable whatsmeow.DownloadableMessage
	mimeType     string
}

func getMediaInfo(msg *events.Message) *mediaInfo {
	if img := msg.Message.GetImageMessage(); img != nil {
		return &mediaInfo{downloadable: img, mimeType: img.GetMimetype()}
	}
	if vid := msg.Message.GetVideoMessage(); vid != nil {
		return &mediaInfo{downloadable: vid, mimeType: vid.GetMimetype()}
	}
	if aud := msg.Message.GetAudioMessage(); aud != nil {
		return &mediaInfo{downloadable: aud, mimeType: aud.GetMimetype()}
	}
	if doc := msg.Message.GetDocumentMessage(); doc != nil {
		return &mediaInfo{downloadable: doc, mimeType: doc.GetMimetype()}
	}
	return nil
}

func uploadToSupabaseStorage(data []byte, bucket, path, mimeType string) error {
	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", supabaseURL, bucket, path)
	req, err := http.NewRequest("POST", url, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+supabaseServiceKey)
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

func updateMediaPath(messageID, chatID, mediaPath string) error {
	_, err := bridgeDB.ExecContext(context.Background(),
		`UPDATE wa_bridge.messages SET media_path = $1 WHERE message_id = $2 AND chat_id = $3`,
		mediaPath, messageID, chatID)
	return err
}

func handleMediaUpload(msg *events.Message, payload MessagePayload) {
	info := getMediaInfo(msg)
	if info == nil {
		return
	}

	data, err := waClient.Download(context.Background(), info.downloadable)
	if err != nil {
		fmt.Printf("Error downloading media %s: %v\n", payload.MessageID, err)
		return
	}

	// Forward audio to voice webhook
	if payload.MediaType == "audio" && voiceWebhookURL != "" {
		go sendToWebhookVoice(payload.SenderID, payload.SenderName, payload.ChatID, payload.MessageID, payload.IsGroup, data)
	}

	ext := mimeToExt(info.mimeType)
	mediaPath := fmt.Sprintf("%s/%s.%s", payload.ChatID, payload.MessageID, ext)

	if err := uploadToSupabaseStorage(data, "wa-media", mediaPath, info.mimeType); err != nil {
		fmt.Printf("Error uploading media %s: %v\n", payload.MessageID, err)
		return
	}

	if err := updateMediaPath(payload.MessageID, payload.ChatID, mediaPath); err != nil {
		fmt.Printf("Error updating media_path %s: %v\n", payload.MessageID, err)
		return
	}

	fmt.Printf("Media stored: %s\n", mediaPath)
}

func registerMessageHandler(client *whatsmeow.Client) {
	client.AddEventHandler(func(evt interface{}) {
		fmt.Printf("Event received: %T\n", evt)
		switch v := evt.(type) {
		case *events.Message:
			handleMessage(v)
		}
	})
}

func handleMessage(msg *events.Message) {
	var sender string

	switch msg.Info.Chat.Server {
	case types.HiddenUserServer:
		sender = msg.Info.MessageSource.SenderAlt.User
	case types.GroupServer:
		sender = msg.Info.MessageSource.Chat.User
	default:
		sender = msg.Info.Sender.User
	}

	payload := MessagePayload{
		Timestamp:  msg.Info.Timestamp,
		MessageID:  msg.Info.ID,
		ChatID:     msg.Info.Chat.String(),
		SenderID:   sender,
		SenderName: msg.Info.PushName,
		IsGroup:    msg.Info.IsGroup,
		IsFromMe:   msg.Info.IsFromMe,
	}

	if msg.Message.GetConversation() != "" {
		payload.MessageType = "text"
		payload.Text = msg.Message.GetConversation()
	} else if msg.Message.ExtendedTextMessage != nil {
		payload.MessageType = "text"
		payload.Text = msg.Message.ExtendedTextMessage.GetText()
	} else if msg.Message.ImageMessage != nil {
		payload.MessageType = "media"
		payload.MediaType = "image"
		payload.Text = msg.Message.ImageMessage.GetCaption()
	} else if msg.Message.VideoMessage != nil {
		payload.MessageType = "media"
		payload.MediaType = "video"
		payload.Text = msg.Message.VideoMessage.GetCaption()
	} else if msg.Message.AudioMessage != nil {
		payload.MessageType = "media"
		payload.MediaType = "audio"
	} else if msg.Message.DocumentMessage != nil {
		payload.MessageType = "media"
		payload.MediaType = "document"
		payload.Text = msg.Message.DocumentMessage.GetCaption()
	} else {
		payload.MessageType = "other"
	}

	go saveMessageToDB(payload)

	if payload.MessageType == "media" && storageConfigured() {
		go handleMediaUpload(msg, payload)
	} else if payload.MediaType == "audio" && voiceWebhookURL != "" {
		// Backward compat: forward audio to voice webhook when storage is not configured
		audioData, err := waClient.Download(context.Background(), msg.Message.AudioMessage)
		if err != nil {
			fmt.Printf("Error downloading audio: %v\n", err)
		} else {
			go sendToWebhookVoice(payload.SenderID, payload.SenderName, payload.ChatID, payload.MessageID, payload.IsGroup, audioData)
		}
	}

	if webhookURL != "" {
		go sendToWebhook(payload)
	}
}

func sendToWebhook(payload MessagePayload) {
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

func sendToWebhookVoice(senderID, senderName, chatID, messageID string, isGroup bool, audioData []byte) {
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

func setQRCode(code string) {
	qrMutex.Lock()
	defer qrMutex.Unlock()
	currentQRCode = code
}

func getQRCode() string {
	qrMutex.RLock()
	defer qrMutex.RUnlock()
	return currentQRCode
}

func startHTTPServer(ctx context.Context, client *whatsmeow.Client) {
	mux := http.NewServeMux()

	mux.HandleFunc("/send", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req SendRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}

		if req.Number == "" || req.Text == "" {
			http.Error(w, "number and text required", http.StatusBadRequest)
			return
		}

		var jid types.JID
		if req.IsGroup {
			jid = types.NewJID(req.Number, types.GroupServer)
		} else {
			jid = types.NewJID(req.Number, types.DefaultUserServer)
		}

		msg := &waProto.Message{
			Conversation: proto.String(req.Text),
		}

		_, err := client.SendMessage(ctx, jid, msg)
		if err != nil {
			http.Error(w, "failed to send", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"sent"}`))
	})

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		connected := client.IsConnected()
		loggedIn := client.Store.ID != nil
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ok","connected":%t,"logged_in":%t}`, connected, loggedIn)
	})

	mux.HandleFunc("/connect", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")

		if client.Store.ID != nil && client.IsConnected() {
			w.Write([]byte(`<!DOCTYPE html>
<html>
<head>
    <title>WhatsApp Connected</title>
    <style>
        body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f0f0; }
        .container { text-align: center; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .success { color: #25D366; font-size: 48px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="success">✓</div>
        <h1>WhatsApp Connected</h1>
        <p>Your WhatsApp is already linked and connected.</p>
    </div>
</body>
</html>`))
			return
		}

		w.Write([]byte(`<!DOCTYPE html>
<html>
<head>
    <title>Connect WhatsApp</title>
    <style>
        body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f0f0; }
        .container { text-align: center; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        img { margin: 20px 0; }
        .waiting { color: #666; }
    </style>
    <script>
        function refreshQR() {
            fetch('/qr')
                .then(r => r.json())
                .then(data => {
                    if (data.connected) {
                        location.reload();
                    } else if (data.qr) {
                        document.getElementById('qr').src = '/qr.png?' + Date.now();
                        document.getElementById('status').textContent = 'Scan this QR code with WhatsApp';
                    } else {
                        document.getElementById('status').textContent = 'Waiting for QR code...';
                    }
                })
                .catch(() => {});
        }
        setInterval(refreshQR, 2000);
    </script>
</head>
<body>
    <div class="container">
        <h1>Connect WhatsApp</h1>
        <p id="status" class="waiting">Scan this QR code with WhatsApp</p>
        <img id="qr" src="/qr.png" width="256" height="256" />
        <p>Open WhatsApp → Settings → Linked Devices → Link a Device</p>
    </div>
</body>
</html>`))
	})

	mux.HandleFunc("/qr", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if client.Store.ID != nil && client.IsConnected() {
			w.Write([]byte(`{"connected":true}`))
			return
		}

		qr := getQRCode()
		if qr == "" {
			w.Write([]byte(`{"connected":false,"qr":null}`))
			return
		}

		w.Write([]byte(`{"connected":false,"qr":"` + qr + `"}`))
	})

	mux.HandleFunc("/qr.png", func(w http.ResponseWriter, r *http.Request) {
		qr := getQRCode()
		if qr == "" {
			http.Error(w, "no QR code available", http.StatusNotFound)
			return
		}

		png, err := qrcode.Encode(qr, qrcode.Medium, 256)
		if err != nil {
			http.Error(w, "failed to generate QR", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "image/png")
		w.Header().Set("Cache-Control", "no-cache")
		w.Write(png)
	})

	go func() {
		fmt.Printf("HTTP server listening on %s\n", listenAddr)
		if err := http.ListenAndServe(listenAddr, mux); err != nil {
			panic(err)
		}
	}()
}

func startClient(ctx context.Context, client *whatsmeow.Client) {
	if client.Store.ID == nil {
		qrChan, _ := client.GetQRChannel(ctx)
		if err := client.Connect(); err != nil {
			panic(err)
		}
		fmt.Println("Waiting for QR code scan. Open /connect in browser to see QR code.")
		for evt := range qrChan {
			if evt.Event == "code" {
				setQRCode(evt.Code)
				qrterminal.Generate(evt.Code, qrterminal.L, os.Stdout)
			} else {
				fmt.Println("Login event:", evt.Event)
				if evt.Event == "success" {
					setQRCode("")
				}
			}
		}
	} else {
		if err := client.Connect(); err != nil {
			panic(err)
		}
		fmt.Println("WhatsApp connected with existing session")
	}
}
