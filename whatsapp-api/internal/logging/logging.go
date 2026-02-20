// Package logging provides structured JSON logging for the WhatsApp bridge.
// It initialises a root zerolog.Logger and exposes helpers to create
// component-scoped sub-loggers, whatsmeow log adapters, and Gin middleware.
package logging

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	waLog "go.mau.fi/whatsmeow/util/log"
)

var root zerolog.Logger

func init() {
	zerolog.TimeFieldFormat = time.RFC3339

	level := zerolog.InfoLevel
	if env := os.Getenv("LOG_LEVEL"); env != "" {
		if parsed, err := zerolog.ParseLevel(strings.ToLower(env)); err == nil {
			level = parsed
		}
	}

	root = zerolog.New(os.Stderr).
		Level(level).
		With().
		Timestamp().
		Str("service", "wa-bridge").
		Logger()
}

// Logger returns the root application logger.
func Logger() zerolog.Logger {
	return root
}

// Component returns a sub-logger with the given component name pre-set.
func Component(name string) zerolog.Logger {
	return root.With().Str("component", name).Logger()
}

// WaLog returns a whatsmeow-compatible logger backed by zerolog.
func WaLog(module string) waLog.Logger {
	sub := root.With().Str("component", strings.ToLower(module)).Logger()
	return waLog.Zerolog(sub)
}

// GinLogger returns Gin middleware that logs requests via zerolog.
func GinLogger() gin.HandlerFunc {
	log := Component("http")
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()

		evt := log.Info()
		if status >= 500 {
			evt = log.Error()
		} else if status >= 400 {
			evt = log.Warn()
		}

		evt.
			Int("status_code", status).
			Str("method", c.Request.Method).
			Str("path", path).
			Str("query", query).
			Dur("latency", latency).
			Str("client_ip", c.ClientIP()).
			Msg("request")
	}
}

// GinRecovery returns Gin middleware that recovers from panics and logs them.
func GinRecovery() gin.HandlerFunc {
	log := Component("http")
	return gin.CustomRecoveryWithWriter(nil, func(c *gin.Context, err any) {
		log.Error().
			Str("method", c.Request.Method).
			Str("path", c.Request.URL.Path).
			Str("error", fmt.Sprintf("%v", err)).
			Msg("panic recovered")
		c.AbortWithStatus(500)
	})
}
