package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// AgentCustomer holds the customer record for the agent.
type AgentCustomer struct {
	ID          string
	Name        string
	Email       sql.NullString
	Phone       sql.NullString
	PhoneNumber sql.NullString
	Notes       sql.NullString
}

// AgentPassenger holds a passenger record linked to a customer.
type AgentPassenger struct {
	ID                    string
	FullName              string
	DateOfBirth           sql.NullString
	Gender                sql.NullString
	Nationality           sql.NullString
	DocumentType          sql.NullString
	DocumentNumber        sql.NullString
	FrequentFlyerAirline  sql.NullString
	FrequentFlyerNumber   sql.NullString
	Notes                 sql.NullString
	Label                 sql.NullString
}

// AgentFlightRequest holds an active flight request.
type AgentFlightRequest struct {
	ID                 string
	Status             string
	Origin             sql.NullString
	Destination        sql.NullString
	DepartureDateStart sql.NullString
	DepartureDateEnd   sql.NullString
	ReturnDateStart    sql.NullString
	ReturnDateEnd      sql.NullString
	Adults             int
	Children           int
	Infants            int
	CabinClass         sql.NullString
	BudgetMin          sql.NullString
	BudgetMax          sql.NullString
	BudgetCurrency     sql.NullString
	Notes              sql.NullString
	CreatedAt          time.Time
}

// AgentFlightRequestPassenger holds a passenger linked to a flight request.
type AgentFlightRequestPassenger struct {
	PassengerID string
	FullName    string
}

// AgentBooking holds a confirmed booking.
type AgentBooking struct {
	ID              string
	PNR             sql.NullString
	Status          string
	TotalPrice      sql.NullString
	Currency        sql.NullString
	BookingSource   sql.NullString
	Notes           sql.NullString
	FlightRequestID sql.NullString
}

// AgentBookingSegment holds a flight segment within a booking.
type AgentBookingSegment struct {
	BookingID    string
	Airline      sql.NullString
	FlightNumber sql.NullString
	Origin       string
	Destination  string
	DepartureAt  sql.NullString
	ArrivalAt    sql.NullString
	CabinClass   sql.NullString
}

// AgentChatMessage holds a message from the chat history.
type AgentChatMessage struct {
	SenderName  sql.NullString
	Content     sql.NullString
	IsFromMe    bool
	IsAgent     bool
	MessageType string
	MediaType   sql.NullString
	Description sql.NullString
	Timestamp   time.Time
}

// GetCustomerByPhone looks up a customer by their WhatsApp phone number.
func (s *Store) GetCustomerByPhone(ctx context.Context, phoneNumber string) (*AgentCustomer, error) {
	var c AgentCustomer
	err := s.db.QueryRowContext(ctx,
		`SELECT id, name, email, phone, phone_number, notes
		 FROM public.customers
		 WHERE phone_number = $1`,
		phoneNumber).Scan(&c.ID, &c.Name, &c.Email, &c.Phone, &c.PhoneNumber, &c.Notes)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// GetCustomerPassengers returns all passengers linked to a customer.
func (s *Store) GetCustomerPassengers(ctx context.Context, customerID string) ([]AgentPassenger, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT p.id, p.full_name, p.date_of_birth, p.gender, p.nationality,
		        p.document_type, p.document_number,
		        p.frequent_flyer_airline, p.frequent_flyer_number,
		        p.notes, cp.label
		 FROM public.passengers p
		 JOIN public.customer_passengers cp ON cp.passenger_id = p.id
		 WHERE cp.customer_id = $1
		 ORDER BY p.full_name`,
		customerID)
	if err != nil {
		return nil, fmt.Errorf("querying customer passengers: %w", err)
	}
	defer rows.Close()

	var passengers []AgentPassenger
	for rows.Next() {
		var p AgentPassenger
		if err := rows.Scan(
			&p.ID, &p.FullName, &p.DateOfBirth, &p.Gender, &p.Nationality,
			&p.DocumentType, &p.DocumentNumber,
			&p.FrequentFlyerAirline, &p.FrequentFlyerNumber,
			&p.Notes, &p.Label,
		); err != nil {
			return passengers, fmt.Errorf("scanning passenger row: %w", err)
		}
		passengers = append(passengers, p)
	}
	return passengers, rows.Err()
}

// GetActiveFlightRequests returns flight requests that are not completed or cancelled.
func (s *Store) GetActiveFlightRequests(ctx context.Context, customerID string) ([]AgentFlightRequest, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, status, origin, destination,
		        departure_date_start, departure_date_end,
		        return_date_start, return_date_end,
		        adults, children, infants, cabin_class,
		        budget_min, budget_max, budget_currency,
		        notes, created_at
		 FROM public.flight_requests
		 WHERE customer_id = $1 AND status NOT IN ('completed', 'cancelled')
		 ORDER BY created_at DESC`,
		customerID)
	if err != nil {
		return nil, fmt.Errorf("querying active flight requests: %w", err)
	}
	defer rows.Close()

	var requests []AgentFlightRequest
	for rows.Next() {
		var r AgentFlightRequest
		if err := rows.Scan(
			&r.ID, &r.Status, &r.Origin, &r.Destination,
			&r.DepartureDateStart, &r.DepartureDateEnd,
			&r.ReturnDateStart, &r.ReturnDateEnd,
			&r.Adults, &r.Children, &r.Infants, &r.CabinClass,
			&r.BudgetMin, &r.BudgetMax, &r.BudgetCurrency,
			&r.Notes, &r.CreatedAt,
		); err != nil {
			return requests, fmt.Errorf("scanning flight request row: %w", err)
		}
		requests = append(requests, r)
	}
	return requests, rows.Err()
}

// GetFlightRequestPassengers returns passengers linked to a specific flight request.
func (s *Store) GetFlightRequestPassengers(ctx context.Context, flightRequestID string) ([]AgentFlightRequestPassenger, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT p.id, p.full_name
		 FROM public.passengers p
		 JOIN public.flight_request_passengers frp ON frp.passenger_id = p.id
		 WHERE frp.flight_request_id = $1
		 ORDER BY p.full_name`,
		flightRequestID)
	if err != nil {
		return nil, fmt.Errorf("querying flight request passengers: %w", err)
	}
	defer rows.Close()

	var passengers []AgentFlightRequestPassenger
	for rows.Next() {
		var p AgentFlightRequestPassenger
		if err := rows.Scan(&p.PassengerID, &p.FullName); err != nil {
			return passengers, fmt.Errorf("scanning flight request passenger: %w", err)
		}
		passengers = append(passengers, p)
	}
	return passengers, rows.Err()
}

// GetActiveBookings returns bookings that are not cancelled.
func (s *Store) GetActiveBookings(ctx context.Context, customerID string) ([]AgentBooking, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, pnr, status, total_price, currency, booking_source, notes, flight_request_id
		 FROM public.bookings
		 WHERE customer_id = $1 AND status NOT IN ('cancelled', 'no_show')
		 ORDER BY created_at DESC`,
		customerID)
	if err != nil {
		return nil, fmt.Errorf("querying active bookings: %w", err)
	}
	defer rows.Close()

	var bookings []AgentBooking
	for rows.Next() {
		var b AgentBooking
		if err := rows.Scan(
			&b.ID, &b.PNR, &b.Status, &b.TotalPrice, &b.Currency,
			&b.BookingSource, &b.Notes, &b.FlightRequestID,
		); err != nil {
			return bookings, fmt.Errorf("scanning booking row: %w", err)
		}
		bookings = append(bookings, b)
	}
	return bookings, rows.Err()
}

// GetBookingSegments returns all segments for a booking.
func (s *Store) GetBookingSegments(ctx context.Context, bookingID string) ([]AgentBookingSegment, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT booking_id, airline, flight_number, origin, destination,
		        departure_at, arrival_at, cabin_class
		 FROM public.booking_segments
		 WHERE booking_id = $1
		 ORDER BY segment_order`,
		bookingID)
	if err != nil {
		return nil, fmt.Errorf("querying booking segments: %w", err)
	}
	defer rows.Close()

	var segments []AgentBookingSegment
	for rows.Next() {
		var seg AgentBookingSegment
		if err := rows.Scan(
			&seg.BookingID, &seg.Airline, &seg.FlightNumber,
			&seg.Origin, &seg.Destination, &seg.DepartureAt,
			&seg.ArrivalAt, &seg.CabinClass,
		); err != nil {
			return segments, fmt.Errorf("scanning booking segment: %w", err)
		}
		segments = append(segments, seg)
	}
	return segments, rows.Err()
}

// GetChatHistory returns the last N messages from a chat, ordered oldest first.
func (s *Store) GetChatHistory(ctx context.Context, chatID string, limit int) ([]AgentChatMessage, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT sender_name, content, is_from_me, is_agent, message_type, media_type, description, timestamp
		 FROM wa_bridge.messages
		 WHERE chat_id = $1
		 ORDER BY timestamp DESC
		 LIMIT $2`,
		chatID, limit)
	if err != nil {
		return nil, fmt.Errorf("querying chat history: %w", err)
	}
	defer rows.Close()

	var messages []AgentChatMessage
	for rows.Next() {
		var m AgentChatMessage
		if err := rows.Scan(
			&m.SenderName, &m.Content, &m.IsFromMe, &m.IsAgent,
			&m.MessageType, &m.MediaType, &m.Description, &m.Timestamp,
		); err != nil {
			return messages, fmt.Errorf("scanning chat message: %w", err)
		}
		messages = append(messages, m)
	}
	if err := rows.Err(); err != nil {
		return messages, err
	}

	// Reverse to get chronological order (oldest first).
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}
	return messages, nil
}

// CreateFlightRequest inserts a new flight request for a customer.
func (s *Store) CreateFlightRequest(ctx context.Context, customerID, chatID string, params map[string]interface{}) (string, error) {
	var id string
	err := s.db.QueryRowContext(ctx,
		`INSERT INTO public.flight_requests (customer_id, chat_id, status, destination, origin,
		        departure_date_start, departure_date_end, return_date_start, return_date_end,
		        adults, children, infants, cabin_class, notes)
		 VALUES ($1, NULLIF($2, ''), 'new',
		         $3, $4, $5, $6, $7, $8,
		         COALESCE($9, 1), COALESCE($10, 0), COALESCE($11, 0),
		         COALESCE($12, 'economy'), $13)
		 RETURNING id`,
		customerID, chatID,
		nullStr(params, "destination"),
		nullStr(params, "origin"),
		nullStr(params, "departure_date_start"),
		nullStr(params, "departure_date_end"),
		nullStr(params, "return_date_start"),
		nullStr(params, "return_date_end"),
		nullInt(params, "adults"),
		nullInt(params, "children"),
		nullInt(params, "infants"),
		nullStr(params, "cabin_class"),
		nullStr(params, "notes"),
	).Scan(&id)
	return id, err
}

// UpdateFlightRequest updates allowed fields on a flight request, verified by customer_id.
func (s *Store) UpdateFlightRequest(ctx context.Context, requestID, customerID string, params map[string]interface{}) error {
	// Build SET clause dynamically from allowed fields.
	allowed := map[string]string{
		"origin":               "origin",
		"destination":          "destination",
		"departure_date_start": "departure_date_start",
		"departure_date_end":   "departure_date_end",
		"return_date_start":    "return_date_start",
		"return_date_end":      "return_date_end",
		"adults":               "adults",
		"children":             "children",
		"infants":              "infants",
		"cabin_class":          "cabin_class",
		"notes":                "notes",
	}

	setClauses := ""
	args := []interface{}{requestID, customerID}
	argIdx := 3

	for paramKey, colName := range allowed {
		if v, ok := params[paramKey]; ok {
			if setClauses != "" {
				setClauses += ", "
			}
			setClauses += fmt.Sprintf("%s = $%d", colName, argIdx)
			args = append(args, v)
			argIdx++
		}
	}

	if setClauses == "" {
		return fmt.Errorf("no valid fields to update")
	}

	query := fmt.Sprintf(
		`UPDATE public.flight_requests SET %s, updated_at = now()
		 WHERE id = $1 AND customer_id = $2`,
		setClauses)

	result, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("flight request not found or not owned by customer")
	}
	return nil
}

// CancelFlightRequest sets a flight request's status to 'cancelled', verified by customer_id.
func (s *Store) CancelFlightRequest(ctx context.Context, requestID, customerID string) error {
	result, err := s.db.ExecContext(ctx,
		`UPDATE public.flight_requests SET status = 'cancelled', updated_at = now()
		 WHERE id = $1 AND customer_id = $2 AND status NOT IN ('completed', 'cancelled')`,
		requestID, customerID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("flight request not found, not owned by customer, or already completed/cancelled")
	}
	return nil
}

// CreatePassenger inserts a new passenger and links it to a customer.
func (s *Store) CreatePassenger(ctx context.Context, customerID string, params map[string]interface{}) (string, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return "", fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	var id string
	err = tx.QueryRowContext(ctx,
		`INSERT INTO public.passengers (full_name, date_of_birth, gender, nationality,
		        document_type, document_number,
		        frequent_flyer_airline, frequent_flyer_number, notes)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id`,
		params["full_name"],
		nullStr(params, "date_of_birth"),
		nullStr(params, "gender"),
		nullStr(params, "nationality"),
		nullStr(params, "document_type"),
		nullStr(params, "document_number"),
		nullStr(params, "frequent_flyer_airline"),
		nullStr(params, "frequent_flyer_number"),
		nullStr(params, "notes"),
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("insert passenger: %w", err)
	}

	_, err = tx.ExecContext(ctx,
		`INSERT INTO public.customer_passengers (customer_id, passenger_id, label)
		 VALUES ($1, $2, $3)`,
		customerID, id, nullStr(params, "label"))
	if err != nil {
		return "", fmt.Errorf("link passenger to customer: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return "", fmt.Errorf("commit: %w", err)
	}
	return id, nil
}

// UpdatePassenger updates allowed fields on a passenger, verified by customer ownership.
func (s *Store) UpdatePassenger(ctx context.Context, passengerID, customerID string, params map[string]interface{}) error {
	// Verify the passenger belongs to the customer.
	var exists bool
	err := s.db.QueryRowContext(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM public.customer_passengers
			WHERE passenger_id = $1 AND customer_id = $2
		)`, passengerID, customerID).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("passenger not found or not linked to customer")
	}

	allowed := map[string]string{
		"full_name":              "full_name",
		"date_of_birth":          "date_of_birth",
		"gender":                 "gender",
		"nationality":            "nationality",
		"document_type":          "document_type",
		"document_number":        "document_number",
		"frequent_flyer_airline": "frequent_flyer_airline",
		"frequent_flyer_number":  "frequent_flyer_number",
		"notes":                  "notes",
	}

	setClauses := ""
	args := []interface{}{passengerID}
	argIdx := 2

	for paramKey, colName := range allowed {
		if v, ok := params[paramKey]; ok {
			if setClauses != "" {
				setClauses += ", "
			}
			setClauses += fmt.Sprintf("%s = $%d", colName, argIdx)
			args = append(args, v)
			argIdx++
		}
	}

	if setClauses == "" {
		return fmt.Errorf("no valid fields to update")
	}

	query := fmt.Sprintf(
		`UPDATE public.passengers SET %s, updated_at = now() WHERE id = $1`,
		setClauses)

	_, err = s.db.ExecContext(ctx, query, args...)
	return err
}

// LinkPassengerToRequest links a passenger to a flight request, verified by customer ownership.
func (s *Store) LinkPassengerToRequest(ctx context.Context, requestID, passengerID, customerID string) error {
	// Verify flight request belongs to customer.
	var reqExists bool
	err := s.db.QueryRowContext(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM public.flight_requests
			WHERE id = $1 AND customer_id = $2
		)`, requestID, customerID).Scan(&reqExists)
	if err != nil {
		return err
	}
	if !reqExists {
		return fmt.Errorf("flight request not found or not owned by customer")
	}

	// Verify passenger belongs to customer.
	var paxExists bool
	err = s.db.QueryRowContext(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM public.customer_passengers
			WHERE passenger_id = $1 AND customer_id = $2
		)`, passengerID, customerID).Scan(&paxExists)
	if err != nil {
		return err
	}
	if !paxExists {
		return fmt.Errorf("passenger not found or not linked to customer")
	}

	_, err = s.db.ExecContext(ctx,
		`INSERT INTO public.flight_request_passengers (flight_request_id, passenger_id)
		 VALUES ($1, $2)
		 ON CONFLICT DO NOTHING`,
		requestID, passengerID)
	return err
}

// AddNote appends text to the notes column of a target entity.
func (s *Store) AddNote(ctx context.Context, targetType, targetID, customerID, note string) error {
	var query string
	switch targetType {
	case "flight_request":
		query = `UPDATE public.flight_requests
		         SET notes = CASE WHEN notes IS NULL OR notes = '' THEN $1
		                          ELSE notes || E'\n' || $1 END,
		             updated_at = now()
		         WHERE id = $2 AND customer_id = $3`
	case "booking":
		query = `UPDATE public.bookings
		         SET notes = CASE WHEN notes IS NULL OR notes = '' THEN $1
		                          ELSE notes || E'\n' || $1 END,
		             updated_at = now()
		         WHERE id = $2 AND customer_id = $3`
	case "passenger":
		// For passengers, verify via customer_passengers link.
		var exists bool
		err := s.db.QueryRowContext(ctx,
			`SELECT EXISTS(SELECT 1 FROM public.customer_passengers WHERE passenger_id = $1 AND customer_id = $2)`,
			targetID, customerID).Scan(&exists)
		if err != nil {
			return err
		}
		if !exists {
			return fmt.Errorf("passenger not linked to customer")
		}
		_, err = s.db.ExecContext(ctx,
			`UPDATE public.passengers
			 SET notes = CASE WHEN notes IS NULL OR notes = '' THEN $1
			                  ELSE notes || E'\n' || $1 END,
			     updated_at = now()
			 WHERE id = $2`,
			note, targetID)
		return err
	default:
		return fmt.Errorf("unsupported target type: %s", targetType)
	}

	result, err := s.db.ExecContext(ctx, query, note, targetID, customerID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("target not found or not owned by customer")
	}
	return nil
}

// SaveAgentMessage inserts an agent-sent message into wa_bridge.messages.
func (s *Store) SaveAgentMessage(ctx context.Context, chatID, content, sentMessageID, senderID string, ts time.Time) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO wa_bridge.messages (message_id, chat_id, sender_id, sender_name, message_type, content, is_from_me, is_agent, timestamp)
		 VALUES ($1, $2, $3, '', 'text', $4, true, true, $5)
		 ON CONFLICT (message_id, chat_id) DO NOTHING`,
		sentMessageID, chatID, senderID, content, ts)
	return err
}

// nullStr extracts a string value from params, returning nil if absent or empty.
func nullStr(params map[string]interface{}, key string) interface{} {
	v, ok := params[key]
	if !ok {
		return nil
	}
	s, ok := v.(string)
	if !ok || s == "" {
		return nil
	}
	return s
}

// nullInt extracts an integer value from params, returning nil if absent.
func nullInt(params map[string]interface{}, key string) interface{} {
	v, ok := params[key]
	if !ok {
		return nil
	}
	switch n := v.(type) {
	case float64:
		return int(n)
	case int:
		return n
	case int64:
		return int(n)
	default:
		return nil
	}
}

// SetAgentActive updates the agent_active flag for a chat.
func (s *Store) SetAgentActive(ctx context.Context, chatID string, active bool) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE wa_bridge.chats SET agent_active = $1 WHERE chat_id = $2`,
		active, chatID)
	return err
}

// IsAgentActive returns whether the agent is active for a chat.
func (s *Store) IsAgentActive(ctx context.Context, chatID string) (bool, error) {
	var active bool
	err := s.db.QueryRowContext(ctx,
		`SELECT COALESCE(agent_active, false) FROM wa_bridge.chats WHERE chat_id = $1`,
		chatID).Scan(&active)
	return active, err
}
