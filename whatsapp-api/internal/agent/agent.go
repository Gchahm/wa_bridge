package agent

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/lib/pq"
	waProto "go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"

	"go.mau.fi/whatsmeow"

	"whatsapp-bridge/internal/logging"
	"whatsapp-bridge/internal/metrics"
	"whatsapp-bridge/internal/store"
)

var log = logging.Component("agent")

const (
	chatHistoryLimit = 30
	claudeTimeout    = 2 * time.Minute
)

// Handler is the core agent orchestrator.
type Handler struct {
	db     *store.Store
	client *whatsmeow.Client

	// chatMu serializes concurrent messages from the same chat
	// to avoid race conditions in context fetching and action execution.
	chatMu sync.Map // map[string]*sync.Mutex
}

// NewHandler creates a new agent handler.
func NewHandler(db *store.Store, client *whatsmeow.Client) *Handler {
	return &Handler{db: db, client: client}
}

// HandleMessage runs the full agent pipeline for an incoming message.
func (h *Handler) HandleMessage(ctx context.Context, req Request) Response {
	pipelineStart := time.Now()

	// Serialize per chat to prevent race conditions.
	mu := h.getChatMutex(req.ChatID)
	mu.Lock()
	defer mu.Unlock()

	// 1. Resolve customer from chat.
	stepStart := time.Now()
	customer, err := h.resolveCustomer(ctx, req.ChatID)
	metrics.AgentStepDuration.WithLabelValues("resolve_customer").Observe(time.Since(stepStart).Seconds())
	if err != nil {
		log.Error().Err(err).Str("chat_id", req.ChatID).Msg("failed to resolve customer")
		metrics.AgentPipelineTotal.WithLabelValues("error").Inc()
		metrics.AgentPipelineDuration.Observe(time.Since(pipelineStart).Seconds())
		return Response{Status: "error", Error: "could not identify customer"}
	}

	// 2. Fetch customer context.
	stepStart = time.Now()
	custCtx, err := h.fetchCustomerContext(ctx, customer)
	metrics.AgentStepDuration.WithLabelValues("fetch_context").Observe(time.Since(stepStart).Seconds())
	if err != nil {
		log.Warn().Err(err).Str("customer_id", customer.ID).Msg("failed to fetch full context, proceeding with partial")
	}

	// 3. Fetch chat history.
	stepStart = time.Now()
	messages, err := h.db.GetChatHistory(ctx, req.ChatID, chatHistoryLimit)
	metrics.AgentStepDuration.WithLabelValues("get_history").Observe(time.Since(stepStart).Seconds())
	if err != nil {
		log.Error().Err(err).Str("chat_id", req.ChatID).Msg("failed to fetch chat history")
		metrics.AgentPipelineTotal.WithLabelValues("error").Inc()
		metrics.AgentPipelineDuration.Observe(time.Since(pipelineStart).Seconds())
		return Response{Status: "error", Error: "could not fetch chat history"}
	}

	// Convert store messages to agent ChatMessage type.
	chatMessages := make([]ChatMessage, len(messages))
	for i, m := range messages {
		chatMessages[i] = ChatMessage{
			SenderName:  m.SenderName.String,
			Content:     m.Content.String,
			IsFromMe:    m.IsFromMe,
			IsAgent:     m.IsAgent,
			MessageType: m.MessageType,
			MediaType:   m.MediaType.String,
			Timestamp:   m.Timestamp,
		}
	}

	// 4. Build prompts.
	currentDate := time.Now().Format("2006-01-02 (Monday)")
	systemPrompt := buildSystemPrompt(custCtx, currentDate)
	userMessage := buildUserMessage(chatMessages)

	// 5. Call Claude.
	stepStart = time.Now()
	claudeOutput, err := h.callClaude(ctx, systemPrompt, userMessage)
	metrics.AgentStepDuration.WithLabelValues("call_claude").Observe(time.Since(stepStart).Seconds())
	if err != nil {
		log.Error().Err(err).Str("chat_id", req.ChatID).Msg("Claude call failed")
		metrics.AgentPipelineTotal.WithLabelValues("error").Inc()
		metrics.AgentPipelineDuration.Observe(time.Since(pipelineStart).Seconds())
		return Response{Status: "error", Error: fmt.Sprintf("Claude call failed: %v", err)}
	}

	// 6. Parse response.
	parsed := parseClaudeResponse(claudeOutput)

	// 7. Execute actions.
	var actionResults []ActionResult
	if len(parsed.Actions) > 0 && customer != nil {
		stepStart = time.Now()
		actionResults = executeActions(ctx, h.db, customer.ID, req.ChatID, parsed.Actions)
		metrics.AgentStepDuration.WithLabelValues("execute_actions").Observe(time.Since(stepStart).Seconds())
	}

	// 8. Send reply via WhatsApp.
	if parsed.Reply != "" {
		stepStart = time.Now()
		if err := h.sendReply(ctx, req.ChatID, parsed.Reply); err != nil {
			metrics.AgentStepDuration.WithLabelValues("send_reply").Observe(time.Since(stepStart).Seconds())
			log.Error().Err(err).Str("chat_id", req.ChatID).Msg("failed to send reply")
			metrics.AgentPipelineTotal.WithLabelValues("partial").Inc()
			metrics.AgentPipelineDuration.Observe(time.Since(pipelineStart).Seconds())
			return Response{
				Status:        "partial",
				Reply:         parsed.Reply,
				ActionResults: actionResults,
				InternalNote:  parsed.InternalNote,
				Error:         fmt.Sprintf("reply generated but send failed: %v", err),
			}
		}
		metrics.AgentStepDuration.WithLabelValues("send_reply").Observe(time.Since(stepStart).Seconds())
	}

	// Auto-deactivate agent if Claude signaled done.
	if parsed.Done {
		if err := h.db.SetAgentActive(ctx, req.ChatID, false); err != nil {
			log.Error().Err(err).Str("chat_id", req.ChatID).Msg("failed to deactivate agent")
		} else {
			log.Info().Str("chat_id", req.ChatID).Msg("agent auto-deactivated (done=true)")
		}
	}

	metrics.AgentPipelineTotal.WithLabelValues("ok").Inc()
	metrics.AgentPipelineDuration.Observe(time.Since(pipelineStart).Seconds())

	return Response{
		Status:        "ok",
		Reply:         parsed.Reply,
		ActionResults: actionResults,
		InternalNote:  parsed.InternalNote,
	}
}

// resolveCustomer finds the customer associated with a chat by looking up
// the contact phone number linked to the chat.
func (h *Handler) resolveCustomer(ctx context.Context, chatID string) (*store.AgentCustomer, error) {
	// First, try to get the phone number from the chat record.
	var phoneNumber sql.NullString
	err := h.db.DB().QueryRowContext(ctx,
		`SELECT contact_phone_number FROM wa_bridge.chats WHERE chat_id = $1`,
		chatID).Scan(&phoneNumber)
	if err != nil {
		return nil, fmt.Errorf("looking up chat: %w", err)
	}
	if !phoneNumber.Valid || phoneNumber.String == "" {
		return nil, fmt.Errorf("chat has no linked contact phone number")
	}

	customer, err := h.db.GetCustomerByPhone(ctx, phoneNumber.String)
	if err != nil {
		return nil, fmt.Errorf("looking up customer by phone %s: %w", phoneNumber.String, err)
	}
	return customer, nil
}

// fetchCustomerContext assembles the full context for the system prompt.
func (h *Handler) fetchCustomerContext(ctx context.Context, customer *store.AgentCustomer) (*CustomerContext, error) {
	if customer == nil {
		return nil, nil
	}

	custCtx := &CustomerContext{
		Customer: Customer{
			ID:          customer.ID,
			Name:        customer.Name,
			Email:       customer.Email.String,
			Phone:       customer.Phone.String,
			PhoneNumber: customer.PhoneNumber.String,
			Notes:       customer.Notes.String,
		},
	}

	// Fetch passengers.
	passengers, err := h.db.GetCustomerPassengers(ctx, customer.ID)
	if err != nil {
		log.Warn().Err(err).Msg("failed to fetch passengers")
	} else {
		for _, p := range passengers {
			custCtx.Passengers = append(custCtx.Passengers, Passenger{
				ID:                    p.ID,
				FullName:              p.FullName,
				DateOfBirth:           p.DateOfBirth.String,
				Gender:                p.Gender.String,
				Nationality:           p.Nationality.String,
				DocumentType:          p.DocumentType.String,
				DocumentNumber:        p.DocumentNumber.String,
				FrequentFlyerAirline:  p.FrequentFlyerAirline.String,
				FrequentFlyerNumber:   p.FrequentFlyerNumber.String,
				Notes:                 p.Notes.String,
				Label:                 p.Label.String,
			})
		}
	}

	// Fetch active flight requests.
	requests, err := h.db.GetActiveFlightRequests(ctx, customer.ID)
	if err != nil {
		log.Warn().Err(err).Msg("failed to fetch flight requests")
	} else {
		for _, r := range requests {
			fr := FlightRequest{
				ID:                 r.ID,
				Status:             r.Status,
				Origin:             r.Origin.String,
				Destination:        r.Destination.String,
				DepartureDateStart: r.DepartureDateStart.String,
				DepartureDateEnd:   r.DepartureDateEnd.String,
				ReturnDateStart:    r.ReturnDateStart.String,
				ReturnDateEnd:      r.ReturnDateEnd.String,
				Adults:             r.Adults,
				Children:           r.Children,
				Infants:            r.Infants,
				CabinClass:         r.CabinClass.String,
				BudgetMin:          r.BudgetMin.String,
				BudgetMax:          r.BudgetMax.String,
				BudgetCurrency:     r.BudgetCurrency.String,
				Notes:              r.Notes.String,
				CreatedAt:          r.CreatedAt.Format("2006-01-02 15:04"),
			}

			// Fetch passengers linked to this request.
			frPassengers, err := h.db.GetFlightRequestPassengers(ctx, r.ID)
			if err != nil {
				log.Warn().Err(err).Str("flight_request_id", r.ID).Msg("failed to fetch flight request passengers")
			} else {
				for _, p := range frPassengers {
					fr.Passengers = append(fr.Passengers, FlightRequestPassenger{
						PassengerID: p.PassengerID,
						FullName:    p.FullName,
					})
				}
			}

			custCtx.FlightRequests = append(custCtx.FlightRequests, fr)
		}
	}

	// Fetch active bookings with segments.
	bookings, err := h.db.GetActiveBookings(ctx, customer.ID)
	if err != nil {
		log.Warn().Err(err).Msg("failed to fetch bookings")
	} else {
		for _, b := range bookings {
			bk := Booking{
				ID:              b.ID,
				PNR:             b.PNR.String,
				Status:          b.Status,
				TotalPrice:      b.TotalPrice.String,
				Currency:        b.Currency.String,
				BookingSource:   b.BookingSource.String,
				Notes:           b.Notes.String,
				FlightRequestID: b.FlightRequestID.String,
			}

			// Fetch segments.
			segments, err := h.db.GetBookingSegments(ctx, b.ID)
			if err != nil {
				log.Warn().Err(err).Str("booking_id", b.ID).Msg("failed to fetch booking segments")
			} else {
				for _, seg := range segments {
					bk.Segments = append(bk.Segments, BookingSegment{
						Airline:      seg.Airline.String,
						FlightNumber: seg.FlightNumber.String,
						Origin:       seg.Origin,
						Destination:  seg.Destination,
						DepartureAt:  seg.DepartureAt.String,
						ArrivalAt:    seg.ArrivalAt.String,
						CabinClass:   seg.CabinClass.String,
					})
				}
			}

			custCtx.Bookings = append(custCtx.Bookings, bk)
		}
	}

	return custCtx, nil
}

// callClaude invokes the Claude CLI with the given system prompt and user message.
func (h *Handler) callClaude(ctx context.Context, systemPrompt, userMessage string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, claudeTimeout)
	defer cancel()

	claudePath, err := exec.LookPath("claude")
	if err != nil {
		return "", fmt.Errorf("claude CLI not found in PATH: %w", err)
	}

	cmd := exec.CommandContext(ctx, claudePath,
		"-p",
		"--output-format", "text",
		"--system-prompt", systemPrompt,
	)
	cmd.Stdin = strings.NewReader(userMessage)

	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("claude CLI execution failed: %w", err)
	}

	return strings.TrimSpace(string(out)), nil
}

// sendReply sends a text message via WhatsApp and saves it to the database.
func (h *Handler) sendReply(ctx context.Context, chatID, text string) error {
	jid, err := types.ParseJID(chatID)
	if err != nil {
		return fmt.Errorf("invalid chat_id JID: %w", err)
	}

	msg := &waProto.Message{
		Conversation: proto.String(text),
	}

	sendStart := time.Now()
	resp, err := h.client.SendMessage(ctx, jid, msg)
	metrics.WASendDuration.WithLabelValues("agent").Observe(time.Since(sendStart).Seconds())
	if err != nil {
		return fmt.Errorf("whatsmeow send failed: %w", err)
	}

	now := time.Now()

	var senderID string
	if h.client.Store.ID != nil {
		senderID = h.client.Store.ID.User
	}

	// Ensure own contact exists for FK constraint.
	h.db.UpsertOwnContact(ctx, senderID)

	// Save the agent message.
	if err := h.db.SaveAgentMessage(ctx, chatID, text, resp.ID, senderID, now); err != nil {
		log.Error().Err(err).Str("message_id", resp.ID).Msg("failed to save agent message")
	}

	// Update chat last_message_at.
	if err := h.db.UpdateChatLastMessage(ctx, chatID, now); err != nil {
		log.Error().Err(err).Str("chat_id", chatID).Msg("failed to update chat last_message_at")
	}

	log.Info().
		Str("message_id", resp.ID).
		Str("chat_id", chatID).
		Int("reply_length", len(text)).
		Msg("agent reply sent")

	return nil
}

// getChatMutex returns a per-chat mutex, creating one if it doesn't exist.
func (h *Handler) getChatMutex(chatID string) *sync.Mutex {
	v, _ := h.chatMu.LoadOrStore(chatID, &sync.Mutex{})
	return v.(*sync.Mutex)
}

// Listen subscribes to the agent_activate Postgres channel. When a chat's
// agent_active transitions to true, it triggers the agent pipeline immediately
// so the agent processes existing chat history without waiting for a new message.
func (h *Handler) Listen(ctx context.Context, databaseURL string) {
	reportProblem := func(ev pq.ListenerEventType, err error) {
		if err != nil {
			log.Error().Err(err).Msg("agent listener error")
		}
	}

	listener := pq.NewListener(databaseURL, 10*time.Second, time.Minute, reportProblem)
	if err := listener.Listen("agent_activate"); err != nil {
		log.Error().Err(err).Msg("failed to LISTEN on agent_activate")
		return
	}
	log.Info().Msg("listening for agent activations on agent_activate channel")

	for {
		select {
		case <-ctx.Done():
			listener.Close()
			return
		case n := <-listener.Notify:
			if n == nil {
				continue
			}
			var payload struct {
				ChatID string `json:"chat_id"`
			}
			if err := json.Unmarshal([]byte(n.Extra), &payload); err != nil {
				log.Error().Err(err).Msg("failed to parse agent_activate notification")
				continue
			}
			log.Info().Str("chat_id", payload.ChatID).Msg("agent activated via toggle")
			go h.HandleMessage(ctx, Request{ChatID: payload.ChatID})
		}
	}
}
