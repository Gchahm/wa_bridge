package agent

import (
	"encoding/json"
	"regexp"
	"strings"
)

// codeBlockRe matches fenced code blocks (```json ... ``` or ``` ... ```).
var codeBlockRe = regexp.MustCompile("(?s)```(?:json)?\\s*\n?(.*?)```")

// parseClaudeResponse attempts to parse Claude's output as a structured JSON
// response. It tries several strategies in order:
//  1. Direct JSON parse of the full output
//  2. Extract JSON from markdown code blocks
//  3. Fallback: treat the entire output as a plain-text reply with no actions
func parseClaudeResponse(raw string) ClaudeResponse {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ClaudeResponse{Reply: ""}
	}

	// Strategy 1: direct JSON parse.
	var resp ClaudeResponse
	if err := json.Unmarshal([]byte(raw), &resp); err == nil && resp.Reply != "" {
		return resp
	}

	// Strategy 2: extract from code blocks.
	matches := codeBlockRe.FindAllStringSubmatch(raw, -1)
	for _, match := range matches {
		if len(match) < 2 {
			continue
		}
		candidate := strings.TrimSpace(match[1])
		var resp2 ClaudeResponse
		if err := json.Unmarshal([]byte(candidate), &resp2); err == nil && resp2.Reply != "" {
			return resp2
		}
	}

	// Strategy 3: fallback to plain text.
	return ClaudeResponse{
		Reply: raw,
	}
}
