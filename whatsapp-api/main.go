package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/mdp/qrterminal/v3"
	"github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
	_ "modernc.org/sqlite"
)

type IncomingMessage struct {
	Timestamp   time.Time `json:"timestamp"`
	MessageID   string    `json:"message_id"`
	ChatID      string    `json:"chat_id"`
	SenderID    string    `json:"sender_id"`
	SenderName  string    `json:"sender_name,omitempty"`
	MessageType string    `json:"message_type"`
	Text        string    `json:"text,omitempty"`
	MediaType   string    `json:"media_type,omitempty"`
	IsGroup     bool      `json:"is_group"`
}

type SendRequest struct {
	Number  string `json:"number"`
	Text    string `json:"text"`
	IsGroup bool   `json:"is_group"`
}

var (
	webhookURL    string
	listenAddr    string
	dataDir       string
	currentQRCode string
	qrMutex       sync.RWMutex
	waClient      *whatsmeow.Client
)

func main() {
	loadConfig()

	ctx := context.Background()
	waClient = newClient(ctx)

	registerMessageHandler(waClient)
	startHTTPServer(ctx, waClient)
	go startClient(ctx, waClient)

	fmt.Println("WhatsApp bridge running. Press Ctrl+C to quit.")
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	<-c
	waClient.Disconnect()
}

func loadConfig() {
	webhookURL = os.Getenv("WEBHOOK_URL")
	listenAddr = os.Getenv("LISTEN_ADDR")
	dataDir = os.Getenv("DATA_DIR")

	if dataDir == "" {
		dataDir = "/data"
	}
	if listenAddr == "" {
		listenAddr = ":8080"
	}
	if webhookURL == "" {
		fmt.Println("Warning: WEBHOOK_URL not set, incoming messages won't be forwarded")
	}
}

func newClient(ctx context.Context) *whatsmeow.Client {
	dbPath := fmt.Sprintf("file:%s/session.db?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)", dataDir)
	dbLog := waLog.Stdout("Database", "WARN", true)
	container, err := sqlstore.New(ctx, "sqlite", dbPath, dbLog)
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

func registerMessageHandler(client *whatsmeow.Client) {
	client.AddEventHandler(func(evt interface{}) {
		switch v := evt.(type) {
		case *events.Message:
			if v.Info.IsFromMe {
				return
			}
			handleIncomingMessage(v)
		}
	})
}

func handleIncomingMessage(msg *events.Message) {
	if webhookURL == "" {
		return
	}

    var sender string

    switch msg.Info.Chat.Server {
    case types.HiddenUserServer:
        sender = msg.Info.MessageSource.SenderAlt.User
    case types.GroupServer:
        sender = msg.Info.MessageSource.Chat.User
    default:
        sender = msg.Info.Sender.User
    }

	payload := IncomingMessage{
		Timestamp:  msg.Info.Timestamp,
		MessageID:  msg.Info.ID,
		ChatID:     msg.Info.Chat.String(),
		SenderID:   sender,
		SenderName: msg.Info.PushName,
		IsGroup:    msg.Info.IsGroup,
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

	go sendToWebhook(payload)
}

func sendToWebhook(payload IncomingMessage) {
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
