// Package agent implements the AI agent that processes WhatsApp messages,
// calls Claude for responses, and executes structured actions.
package agent

import "time"

// Request is the JSON body accepted by POST /agent from n8n.
type Request struct {
	ChatID    string `json:"chat_id" binding:"required"`
	SenderID  string `json:"sender_id"`
	IsGroup   bool   `json:"is_group"`
	IsFromMe  bool   `json:"is_from_me"`
	Text      string `json:"text"`
	MessageID string `json:"message_id"`
}

// Response is the JSON returned by POST /agent to n8n.
type Response struct {
	Status        string         `json:"status"`
	Reply         string         `json:"reply,omitempty"`
	ActionResults []ActionResult `json:"action_results,omitempty"`
	InternalNote  string         `json:"internal_note,omitempty"`
	Error         string         `json:"error,omitempty"`
}

// ClaudeResponse is the structured JSON that Claude returns.
type ClaudeResponse struct {
	Reply        string   `json:"reply"`
	Actions      []Action `json:"actions,omitempty"`
	InternalNote string   `json:"internal_note,omitempty"`
}

// Action is a single action for the agent to execute.
type Action struct {
	Type   string                 `json:"type"`
	Params map[string]interface{} `json:"params"`
}

// ActionResult records the outcome of an executed action.
type ActionResult struct {
	Type    string `json:"type"`
	Success bool   `json:"success"`
	ID      string `json:"id,omitempty"`
	Error   string `json:"error,omitempty"`
}

// CustomerContext bundles all the data Claude needs about the current customer.
type CustomerContext struct {
	Customer       Customer        `json:"customer"`
	Passengers     []Passenger     `json:"passengers,omitempty"`
	FlightRequests []FlightRequest `json:"flight_requests,omitempty"`
	Bookings       []Booking       `json:"bookings,omitempty"`
}

// Customer is a CRM customer record.
type Customer struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Email       string `json:"email,omitempty"`
	Phone       string `json:"phone,omitempty"`
	PhoneNumber string `json:"phone_number,omitempty"`
	Notes       string `json:"notes,omitempty"`
}

// Passenger is a traveller profile.
type Passenger struct {
	ID                    string `json:"id"`
	FullName              string `json:"full_name"`
	DateOfBirth           string `json:"date_of_birth,omitempty"`
	Gender                string `json:"gender,omitempty"`
	Nationality           string `json:"nationality,omitempty"`
	DocumentType          string `json:"document_type,omitempty"`
	DocumentNumber        string `json:"document_number,omitempty"`
	FrequentFlyerAirline  string `json:"frequent_flyer_airline,omitempty"`
	FrequentFlyerNumber   string `json:"frequent_flyer_number,omitempty"`
	Notes                 string `json:"notes,omitempty"`
	Label                 string `json:"label,omitempty"`
}

// FlightRequest is an open travel enquiry.
type FlightRequest struct {
	ID                 string `json:"id"`
	Status             string `json:"status"`
	Origin             string `json:"origin,omitempty"`
	Destination        string `json:"destination,omitempty"`
	DepartureDateStart string `json:"departure_date_start,omitempty"`
	DepartureDateEnd   string `json:"departure_date_end,omitempty"`
	ReturnDateStart    string `json:"return_date_start,omitempty"`
	ReturnDateEnd      string `json:"return_date_end,omitempty"`
	Adults             int    `json:"adults"`
	Children           int    `json:"children"`
	Infants            int    `json:"infants"`
	CabinClass         string `json:"cabin_class,omitempty"`
	BudgetMin          string `json:"budget_min,omitempty"`
	BudgetMax          string `json:"budget_max,omitempty"`
	BudgetCurrency     string `json:"budget_currency,omitempty"`
	Notes              string `json:"notes,omitempty"`
	CreatedAt          string `json:"created_at,omitempty"`
	Passengers         []FlightRequestPassenger `json:"passengers,omitempty"`
}

// FlightRequestPassenger is a passenger linked to a flight request.
type FlightRequestPassenger struct {
	PassengerID string `json:"passenger_id"`
	FullName    string `json:"full_name"`
}

// Booking is a confirmed travel reservation.
type Booking struct {
	ID               string           `json:"id"`
	PNR              string           `json:"pnr,omitempty"`
	Status           string           `json:"status"`
	TotalPrice       string           `json:"total_price,omitempty"`
	Currency         string           `json:"currency,omitempty"`
	BookingSource    string           `json:"booking_source,omitempty"`
	Notes            string           `json:"notes,omitempty"`
	Segments         []BookingSegment `json:"segments,omitempty"`
	FlightRequestID  string           `json:"flight_request_id,omitempty"`
}

// BookingSegment is a flight leg within a booking.
type BookingSegment struct {
	Airline      string `json:"airline,omitempty"`
	FlightNumber string `json:"flight_number,omitempty"`
	Origin       string `json:"origin"`
	Destination  string `json:"destination"`
	DepartureAt  string `json:"departure_at,omitempty"`
	ArrivalAt    string `json:"arrival_at,omitempty"`
	CabinClass   string `json:"cabin_class,omitempty"`
}

// ChatMessage is a single message in the conversation history.
type ChatMessage struct {
	SenderName  string    `json:"sender_name"`
	Content     string    `json:"content"`
	IsFromMe    bool      `json:"is_from_me"`
	IsAgent     bool      `json:"is_agent"`
	MessageType string    `json:"message_type"`
	MediaType   string    `json:"media_type"`
	Timestamp   time.Time `json:"timestamp"`
}
