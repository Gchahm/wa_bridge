package agent

import (
	"context"
	"fmt"

	"whatsapp-bridge/internal/store"
)

// actionFunc is the signature for an action handler.
type actionFunc func(ctx context.Context, db *store.Store, customerID, chatID string, params map[string]interface{}) ActionResult

// actionRegistry maps action type names to their handler functions.
var actionRegistry = map[string]actionFunc{
	"create_flight_request":     executeCreateFlightRequest,
	"update_flight_request":     executeUpdateFlightRequest,
	"cancel_flight_request":     executeCancelFlightRequest,
	"link_passenger_to_request": executeLinkPassengerToRequest,
	"add_note":                  executeAddNote,
	"create_passenger":          executeCreatePassenger,
	"update_passenger":          executeUpdatePassenger,
}

// executeActions dispatches each action through the registry and collects results.
func executeActions(ctx context.Context, db *store.Store, customerID, chatID string, actions []Action) []ActionResult {
	var results []ActionResult
	for _, action := range actions {
		handler, ok := actionRegistry[action.Type]
		if !ok {
			log.Warn().Str("action_type", action.Type).Msg("unknown action type, skipping")
			results = append(results, ActionResult{
				Type:  action.Type,
				Error: fmt.Sprintf("unknown action type: %s", action.Type),
			})
			continue
		}

		result := handler(ctx, db, customerID, chatID, action.Params)
		results = append(results, result)

		if result.Success {
			log.Info().
				Str("action_type", action.Type).
				Str("id", result.ID).
				Msg("action executed successfully")
		} else {
			log.Warn().
				Str("action_type", action.Type).
				Str("error", result.Error).
				Msg("action failed")
		}
	}
	return results
}

// requireString extracts a required string parameter, returning an error result if missing.
func requireString(params map[string]interface{}, key string) (string, error) {
	v, ok := params[key]
	if !ok {
		return "", fmt.Errorf("missing required parameter: %s", key)
	}
	s, ok := v.(string)
	if !ok || s == "" {
		return "", fmt.Errorf("parameter %s must be a non-empty string", key)
	}
	return s, nil
}
