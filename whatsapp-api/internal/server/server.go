// Package server registers and starts the HTTP API for the WhatsApp bridge.
package server

import (
	"context"
	"embed"
	"fmt"
	"html/template"
	"net/http"
	"os/exec"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/skip2/go-qrcode"
	waProto "go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"

	"go.mau.fi/whatsmeow"

	"whatsapp-bridge/internal/agent"
	"whatsapp-bridge/internal/logging"
	"whatsapp-bridge/internal/metrics"
	"whatsapp-bridge/internal/store"
	"whatsapp-bridge/internal/waclient"
)

var log = logging.Component("server")

//go:embed templates/*.html
var templateFS embed.FS

// SendRequest is the JSON body accepted by POST /send.
type SendRequest struct {
	Number  string `json:"number" binding:"required"`
	Text    string `json:"text" binding:"required"`
	IsGroup bool   `json:"is_group"`
}

// UpdateDescriptionRequest is the JSON body accepted by POST /messages/description.
type UpdateDescriptionRequest struct {
	MessageID   string `json:"message_id" binding:"required"`
	ChatID      string `json:"chat_id" binding:"required"`
	Description string `json:"description"`
}

// ClaudeRequest is the JSON body accepted by POST /claude.
type ClaudeRequest struct {
	SystemPrompt string `json:"system_prompt" binding:"required"`
	UserMessage  string `json:"user_message" binding:"required"`
}

type handler struct {
	client  *whatsmeow.Client
	qrStore *waclient.QRStore
	db      *store.Store
	agent   *agent.Handler
	ctx     context.Context
}

func (h *handler) send(c *gin.Context) {
	var req SendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.String(http.StatusBadRequest, "number and text required")
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

	sendStart := time.Now()
	_, err := h.client.SendMessage(h.ctx, jid, msg)
	metrics.WASendDuration.WithLabelValues("http").Observe(time.Since(sendStart).Seconds())
	if err != nil {
		c.String(http.StatusInternalServerError, "failed to send")
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "sent"})
}

func (h *handler) health(c *gin.Context) {
	connected := h.client.IsConnected()
	loggedIn := h.client.Store.ID != nil
	c.JSON(http.StatusOK, gin.H{
		"status":    "ok",
		"connected": connected,
		"logged_in": loggedIn,
	})
}

func (h *handler) connect(c *gin.Context) {
	if h.client.Store.ID != nil && h.client.IsConnected() {
		c.HTML(http.StatusOK, "connected.html", nil)
		return
	}
	c.HTML(http.StatusOK, "connect.html", nil)
}

func (h *handler) qr(c *gin.Context) {
	if h.client.Store.ID != nil && h.client.IsConnected() {
		c.JSON(http.StatusOK, gin.H{"connected": true})
		return
	}

	qr := h.qrStore.Get()
	if qr == "" {
		c.JSON(http.StatusOK, gin.H{"connected": false, "qr": nil})
		return
	}

	c.JSON(http.StatusOK, gin.H{"connected": false, "qr": qr})
}

func (h *handler) qrPNG(c *gin.Context) {
	qr := h.qrStore.Get()
	if qr == "" {
		c.String(http.StatusNotFound, "no QR code available")
		return
	}

	png, err := qrcode.Encode(qr, qrcode.Medium, 256)
	if err != nil {
		c.String(http.StatusInternalServerError, "failed to generate QR")
		return
	}

	c.Header("Cache-Control", "no-cache")
	c.Data(http.StatusOK, "image/png", png)
}

func (h *handler) disconnect(c *gin.Context) {
	if h.client.Store.ID == nil {
		c.JSON(http.StatusOK, gin.H{"status": "already disconnected"})
		return
	}

	if err := h.client.Logout(h.ctx); err != nil {
		log.Error().Err(err).Msg("failed to logout")
		c.String(http.StatusInternalServerError, "failed to logout")
		return
	}

	log.Info().Msg("logged out, starting new QR code flow")
	go waclient.Connect(h.ctx, h.client, h.qrStore)

	c.JSON(http.StatusOK, gin.H{"status": "disconnected"})
}

func (h *handler) updateDescription(c *gin.Context) {
	var req UpdateDescriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Warn().Err(err).Msg("invalid update description request")
		c.String(http.StatusBadRequest, "message_id and chat_id are required")
		return
	}

	if req.Description == "" {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "skipped": true})
		return
	}

	if err := h.db.UpdateDescription(req.MessageID, req.ChatID, req.Description); err != nil {
		log.Error().Err(err).
			Str("message_id", req.MessageID).
			Str("chat_id", req.ChatID).
			Msg("failed to update description")
		c.String(http.StatusInternalServerError, "failed to update description")
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *handler) agentHandler(c *gin.Context) {
	var req agent.Request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, agent.Response{Status: "error", Error: "chat_id is required"})
		return
	}

	resp := h.agent.HandleMessage(c.Request.Context(), req)

	status := http.StatusOK
	if resp.Status == "error" {
		status = http.StatusInternalServerError
	}
	c.JSON(status, resp)
}

func (h *handler) claudeReply(c *gin.Context) {
	var req ClaudeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "system_prompt and user_message are required"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Minute)
	defer cancel()

	claudePath, err := exec.LookPath("claude")
	if err != nil {
		log.Error().Err(err).Msg("claudeReply: claude CLI not found in PATH")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "claude CLI not found in PATH"})
		return
	}

	cmd := exec.CommandContext(ctx, claudePath, "-p", "--output-format", "text", "--system-prompt", req.SystemPrompt)
	cmd.Stdin = strings.NewReader(req.UserMessage)

	out, err := cmd.Output()
	if err != nil {
		log.Error().Err(err).Msg("claudeReply: claude CLI failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("claude CLI error: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"reply": strings.TrimSpace(string(out))})
}

// Start registers all HTTP routes and begins serving on listenAddr.
// It runs the HTTP server in a goroutine and returns immediately.
func Start(ctx context.Context, client *whatsmeow.Client, qrStore *waclient.QRStore, db *store.Store, agentHandler *agent.Handler, listenAddr string) {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(logging.GinLogger(), logging.GinRecovery())

	tmpl, err := template.ParseFS(templateFS, "templates/*.html")
	if err != nil {
		panic(fmt.Sprintf("server: parse templates: %v", err))
	}
	r.SetHTMLTemplate(tmpl)

	h := &handler{client: client, qrStore: qrStore, db: db, agent: agentHandler, ctx: ctx}
	r.POST("/send", h.send)
	r.POST("/agent", h.agentHandler)
	r.GET("/health", h.health)
	r.GET("/connect", h.connect)
	r.GET("/qr", h.qr)
	r.GET("/qr.png", h.qrPNG)
	r.POST("/messages/description", h.updateDescription)
	r.POST("/disconnect", h.disconnect)
	r.POST("/claude", h.claudeReply)
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	go func() {
		log.Info().Str("addr", listenAddr).Msg("HTTP server listening")
		if err := r.Run(listenAddr); err != nil {
			panic(err)
		}
	}()
}
