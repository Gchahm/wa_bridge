package config

import (
	"os"

	"whatsapp-bridge/internal/logging"
)

var log = logging.Component("config")

// Config holds all application configuration loaded from environment variables.
type Config struct {
	DatabaseURL        string
	ListenAddr         string
	WebhookURL         string
	VoiceWebhookURL    string
	SupabaseURL        string
	SupabaseServiceKey string
}

// Load reads configuration from environment variables and returns a Config.
// It panics if required variables are missing.
func Load() Config {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		panic("DATABASE_URL is required")
	}

	listenAddr := os.Getenv("LISTEN_ADDR")
	if listenAddr == "" {
		listenAddr = ":8080"
	}

	webhookURL := os.Getenv("MESSAGE_WEBHOOK_URL")
	if webhookURL == "" {
		log.Warn().Msg("MESSAGE_WEBHOOK_URL not set, incoming messages won't be forwarded")
	}

	voiceWebhookURL := os.Getenv("VOICE_WEBHOOK_URL")
	if voiceWebhookURL == "" {
		log.Warn().Msg("VOICE_WEBHOOK_URL not set, audio messages won't be forwarded")
	}

	return Config{
		DatabaseURL:        databaseURL,
		ListenAddr:         listenAddr,
		WebhookURL:         webhookURL,
		VoiceWebhookURL:    voiceWebhookURL,
		SupabaseURL:        os.Getenv("SUPABASE_URL"),
		SupabaseServiceKey: os.Getenv("SUPABASE_SERVICE_KEY"),
	}
}

// StorageConfigured reports whether Supabase storage credentials are present.
func (c Config) StorageConfigured() bool {
	return c.SupabaseURL != "" && c.SupabaseServiceKey != ""
}
