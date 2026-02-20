package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"whatsapp-bridge/internal/config"
	"whatsapp-bridge/internal/messaging"
	"whatsapp-bridge/internal/outbox"
	"whatsapp-bridge/internal/server"
	"whatsapp-bridge/internal/store"
	"whatsapp-bridge/internal/waclient"
)

func main() {
	cfg := config.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	db := store.New(cfg.DatabaseURL)
	defer db.Close()

	qrStore := &waclient.QRStore{}
	client := waclient.New(ctx, cfg.DatabaseURL)

	messaging.RegisterHandler(client, cfg, db)
	server.Start(ctx, client, qrStore, db, cfg.ListenAddr)
	go waclient.Connect(ctx, client, qrStore)
	go outbox.Listen(ctx, client, db, cfg.DatabaseURL)

	fmt.Println("WhatsApp bridge running. Press Ctrl+C to quit.")
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	<-c

	cancel()
	client.Disconnect()
}
