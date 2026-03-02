package agent

import (
	"context"

	"whatsapp-bridge/internal/store"
)

func executeCreateFlightRequest(ctx context.Context, db *store.Store, customerID, chatID string, params map[string]interface{}) ActionResult {
	id, err := db.CreateFlightRequest(ctx, customerID, chatID, params)
	if err != nil {
		return ActionResult{Type: "create_flight_request", Error: err.Error()}
	}
	return ActionResult{Type: "create_flight_request", Success: true, ID: id}
}

func executeUpdateFlightRequest(ctx context.Context, db *store.Store, customerID, chatID string, params map[string]interface{}) ActionResult {
	requestID, err := requireString(params, "flight_request_id")
	if err != nil {
		return ActionResult{Type: "update_flight_request", Error: err.Error()}
	}

	// Remove flight_request_id from params so it's not treated as a column to update.
	updateParams := make(map[string]interface{}, len(params)-1)
	for k, v := range params {
		if k != "flight_request_id" {
			updateParams[k] = v
		}
	}

	if err := db.UpdateFlightRequest(ctx, requestID, customerID, updateParams); err != nil {
		return ActionResult{Type: "update_flight_request", Error: err.Error()}
	}
	return ActionResult{Type: "update_flight_request", Success: true, ID: requestID}
}

func executeCancelFlightRequest(ctx context.Context, db *store.Store, customerID, _ string, params map[string]interface{}) ActionResult {
	requestID, err := requireString(params, "flight_request_id")
	if err != nil {
		return ActionResult{Type: "cancel_flight_request", Error: err.Error()}
	}

	if err := db.CancelFlightRequest(ctx, requestID, customerID); err != nil {
		return ActionResult{Type: "cancel_flight_request", Error: err.Error()}
	}
	return ActionResult{Type: "cancel_flight_request", Success: true, ID: requestID}
}

func executeLinkPassengerToRequest(ctx context.Context, db *store.Store, customerID, _ string, params map[string]interface{}) ActionResult {
	requestID, err := requireString(params, "flight_request_id")
	if err != nil {
		return ActionResult{Type: "link_passenger_to_request", Error: err.Error()}
	}

	passengerID, err := requireString(params, "passenger_id")
	if err != nil {
		return ActionResult{Type: "link_passenger_to_request", Error: err.Error()}
	}

	if err := db.LinkPassengerToRequest(ctx, requestID, passengerID, customerID); err != nil {
		return ActionResult{Type: "link_passenger_to_request", Error: err.Error()}
	}
	return ActionResult{Type: "link_passenger_to_request", Success: true, ID: requestID}
}

func executeAddNote(ctx context.Context, db *store.Store, customerID, _ string, params map[string]interface{}) ActionResult {
	targetType, err := requireString(params, "target_type")
	if err != nil {
		return ActionResult{Type: "add_note", Error: err.Error()}
	}

	targetID, err := requireString(params, "target_id")
	if err != nil {
		return ActionResult{Type: "add_note", Error: err.Error()}
	}

	note, err := requireString(params, "note")
	if err != nil {
		return ActionResult{Type: "add_note", Error: err.Error()}
	}

	if err := db.AddNote(ctx, targetType, targetID, customerID, note); err != nil {
		return ActionResult{Type: "add_note", Error: err.Error()}
	}
	return ActionResult{Type: "add_note", Success: true, ID: targetID}
}
