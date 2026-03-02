package agent

import (
	"context"

	"whatsapp-bridge/internal/store"
)

func executeCreatePassenger(ctx context.Context, db *store.Store, customerID, _ string, params map[string]interface{}) ActionResult {
	if _, err := requireString(params, "full_name"); err != nil {
		return ActionResult{Type: "create_passenger", Error: err.Error()}
	}

	id, err := db.CreatePassenger(ctx, customerID, params)
	if err != nil {
		return ActionResult{Type: "create_passenger", Error: err.Error()}
	}
	return ActionResult{Type: "create_passenger", Success: true, ID: id}
}

func executeUpdatePassenger(ctx context.Context, db *store.Store, customerID, _ string, params map[string]interface{}) ActionResult {
	passengerID, err := requireString(params, "passenger_id")
	if err != nil {
		return ActionResult{Type: "update_passenger", Error: err.Error()}
	}

	// Remove passenger_id from params so it's not treated as a column to update.
	updateParams := make(map[string]interface{}, len(params)-1)
	for k, v := range params {
		if k != "passenger_id" {
			updateParams[k] = v
		}
	}

	if err := db.UpdatePassenger(ctx, passengerID, customerID, updateParams); err != nil {
		return ActionResult{Type: "update_passenger", Error: err.Error()}
	}
	return ActionResult{Type: "update_passenger", Success: true, ID: passengerID}
}
