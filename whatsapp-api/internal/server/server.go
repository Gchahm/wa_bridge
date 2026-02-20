// Package server registers and starts the HTTP API for the WhatsApp bridge.
package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/skip2/go-qrcode"
	waProto "go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"

	"go.mau.fi/whatsmeow"

	"whatsapp-bridge/internal/store"
	"whatsapp-bridge/internal/waclient"
)

// SendRequest is the JSON body accepted by POST /send.
type SendRequest struct {
	Number  string `json:"number"`
	Text    string `json:"text"`
	IsGroup bool   `json:"is_group"`
}

// Start registers all HTTP routes and begins serving on listenAddr.
// It runs the HTTP server in a goroutine and returns immediately.
func Start(ctx context.Context, client *whatsmeow.Client, qrStore *waclient.QRStore, db *store.Store, listenAddr string) {
	mux := http.NewServeMux()

	mux.HandleFunc("/send", makeSendHandler(ctx, client))
	mux.HandleFunc("/health", makeHealthHandler(client))
	mux.HandleFunc("/connect", makeConnectHandler(client))
	mux.HandleFunc("/qr", makeQRHandler(client, qrStore))
	mux.HandleFunc("/qr.png", makeQRPNGHandler(qrStore))
	mux.HandleFunc("/messages/description", makeUpdateDescriptionHandler(db))

	go func() {
		fmt.Printf("HTTP server listening on %s\n", listenAddr)
		if err := http.ListenAndServe(listenAddr, mux); err != nil {
			panic(err)
		}
	}()
}

func makeSendHandler(ctx context.Context, client *whatsmeow.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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

		if _, err := client.SendMessage(ctx, jid, msg); err != nil {
			http.Error(w, "failed to send", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"sent"}`))
	}
}

func makeHealthHandler(client *whatsmeow.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		connected := client.IsConnected()
		loggedIn := client.Store.ID != nil
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ok","connected":%t,"logged_in":%t}`, connected, loggedIn)
	}
}

func makeConnectHandler(client *whatsmeow.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")

		if client.Store.ID != nil && client.IsConnected() {
			w.Write([]byte(connectedHTML))
			return
		}
		w.Write([]byte(connectHTML))
	}
}

func makeQRHandler(client *whatsmeow.Client, qrStore *waclient.QRStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if client.Store.ID != nil && client.IsConnected() {
			w.Write([]byte(`{"connected":true}`))
			return
		}

		qr := qrStore.Get()
		if qr == "" {
			w.Write([]byte(`{"connected":false,"qr":null}`))
			return
		}

		w.Write([]byte(`{"connected":false,"qr":"` + qr + `"}`))
	}
}

func makeQRPNGHandler(qrStore *waclient.QRStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		qr := qrStore.Get()
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
	}
}

// UpdateDescriptionRequest is the JSON body accepted by POST /messages/description.
type UpdateDescriptionRequest struct {
	MessageID   string `json:"message_id"`
	ChatID      string `json:"chat_id"`
	Description string `json:"description"`
}

func makeUpdateDescriptionHandler(db *store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req UpdateDescriptionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}

		if req.MessageID == "" || req.ChatID == "" || req.Description == "" {
			http.Error(w, "message_id, chat_id, and description are required", http.StatusBadRequest)
			return
		}

		if err := db.UpdateDescription(req.MessageID, req.ChatID, req.Description); err != nil {
			fmt.Printf("server: update description: %v\n", err)
			http.Error(w, "failed to update description", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	}
}

const connectedHTML = `<!DOCTYPE html>
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
        <div class="success">&#10003;</div>
        <h1>WhatsApp Connected</h1>
        <p>Your WhatsApp is already linked and connected.</p>
    </div>
</body>
</html>`

const connectHTML = `<!DOCTYPE html>
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
        <p>Open WhatsApp &#x2192; Settings &#x2192; Linked Devices &#x2192; Link a Device</p>
    </div>
</body>
</html>`
