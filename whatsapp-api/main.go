package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"whatsapp-bridge/internal/agent"
	"whatsapp-bridge/internal/commands"
	"whatsapp-bridge/internal/config"
	"whatsapp-bridge/internal/logging"
	"whatsapp-bridge/internal/messaging"
	"whatsapp-bridge/internal/metrics"
	"whatsapp-bridge/internal/outbox"
	"whatsapp-bridge/internal/server"
	"whatsapp-bridge/internal/store"
	"whatsapp-bridge/internal/waclient"
)

var log = logging.Component("main")

func main() {
	cfg := config.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	db := store.New(cfg.DatabaseURL)
	defer db.Close()

	qrStore := &waclient.QRStore{}
	client := waclient.New(ctx, cfg.DatabaseURL)

	agentHandler := agent.NewHandler(db, client)
	cmdListener := commands.New(client, db, cfg.DatabaseURL)
	messaging.RegisterHandler(client, cfg, db, agentHandler, cmdListener)
	server.Start(ctx, client, qrStore, db, agentHandler, cfg.ListenAddr)
	go waclient.Connect(ctx, client, qrStore)
	go outbox.Listen(ctx, client, db, cfg.DatabaseURL)
	go messaging.ListenGroupChats(ctx, client, db, cfg.DatabaseURL)
	go agentHandler.Listen(ctx, cfg.DatabaseURL)
	go cmdListener.Listen(ctx)
	go func() {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if client.IsConnected() {
					metrics.WhatsAppConnected.Set(1)
				} else {
					metrics.WhatsAppConnected.Set(0)
				}
			}
		}
	}()

	log.Info().Msg("WhatsApp bridge running, press Ctrl+C to quit")
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	<-c

	cancel()
	client.Disconnect()
}
