// Package waclient manages the WhatsApp client lifecycle: creation, QR code
// state, and the connect/login flow.
package waclient

import (
	"context"
	"os"
	"sync"

	"github.com/mdp/qrterminal/v3"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"

	"whatsapp-bridge/internal/logging"
)

var log = logging.Component("waclient")

// QRStore holds the latest QR code string behind a read-write mutex so it can
// be shared safely between the connect goroutine and HTTP handlers.
type QRStore struct {
	mu   sync.RWMutex
	code string
}

// Set replaces the current QR code.
func (q *QRStore) Set(code string) {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.code = code
}

// Get returns the current QR code, or "" if none is available.
func (q *QRStore) Get() string {
	q.mu.RLock()
	defer q.mu.RUnlock()
	return q.code
}

// New creates a whatsmeow client backed by the Postgres device store at
// databaseURL. It panics on any unrecoverable setup error.
func New(ctx context.Context, databaseURL string) *whatsmeow.Client {
	dbLog := logging.WaLog("Database")
	container, err := sqlstore.New(ctx, "postgres", databaseURL, dbLog)
	if err != nil {
		panic(err)
	}
	deviceStore, err := container.GetFirstDevice(ctx)
	if err != nil {
		panic(err)
	}
	clientLog := logging.WaLog("Client")
	return whatsmeow.NewClient(deviceStore, clientLog)
}

// Connect starts the WhatsApp connection. If the device is not yet registered
// it enters the QR-code login flow, storing each successive code in qrStore
// so that HTTP handlers can serve it. This function blocks until login
// completes and should be run in a goroutine.
func Connect(ctx context.Context, client *whatsmeow.Client, qrStore *QRStore) {
	if client.Store.ID == nil {
		qrChan, _ := client.GetQRChannel(ctx)
		if err := client.Connect(); err != nil {
			panic(err)
		}
		log.Info().Msg("waiting for QR code scan, open /connect in browser to see QR code")
		for evt := range qrChan {
			if evt.Event == "code" {
				qrStore.Set(evt.Code)
				qrterminal.Generate(evt.Code, qrterminal.L, os.Stdout)
			} else {
				log.Info().Str("event", evt.Event).Msg("login event")
				if evt.Event == "success" {
					qrStore.Set("")
				}
			}
		}
		return
	}

	if err := client.Connect(); err != nil {
		panic(err)
	}
	log.Info().Msg("WhatsApp connected with existing session")
}
