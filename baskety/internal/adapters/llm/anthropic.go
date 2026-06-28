package llm

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/willian-m/baskety/internal/receipt"
)

// AnthropicLLM calls the Anthropic Messages API directly via net/http.
type AnthropicLLM struct {
	APIKey string
	Model  string
}

func NewAnthropicLLM(apiKey, model string) *AnthropicLLM {
	if model == "" {
		model = "claude-haiku-4-5-20251001"
	}
	return &AnthropicLLM{APIKey: apiKey, Model: model}
}

func (l *AnthropicLLM) ParseReceipt(ctx context.Context, ocrText string) ([]receipt.ParsedLineItem, string, error) {
	prompt := parsePrompt + ocrText
	// Force the model to use our tool: the tool_use block's "input" is a JSON
	// object matching the schema, which we parse directly — more reliable than
	// asking for free-form JSON in the text response.
	reqBody := map[string]any{
		"model":      l.Model,
		"max_tokens": 4096,
		"system":     "You are a precise receipt-parsing assistant.",
		"tools": []map[string]any{{
			"name":         recordLineItemsTool,
			"description":  "Record the line items extracted from the receipt.",
			"input_schema": lineItemsResultSchema(),
		}},
		"tool_choice": map[string]any{"type": "tool", "name": recordLineItemsTool},
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
	}
	headers := map[string]string{
		"x-api-key":         l.APIKey,
		"anthropic-version": "2023-06-01",
	}
	data, err := doJSONPost(ctx, "https://api.anthropic.com/v1/messages", headers, reqBody)
	if err != nil {
		return nil, "", fmt.Errorf("anthropic: %w", err)
	}
	var resp struct {
		Content []struct {
			Type  string          `json:"type"`
			Text  string          `json:"text"`
			Name  string          `json:"name"`
			Input json.RawMessage `json:"input"`
		} `json:"content"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, "", fmt.Errorf("anthropic decode: %w", err)
	}
	if len(resp.Content) == 0 {
		return nil, "", fmt.Errorf("anthropic: empty content")
	}
	// Prefer the tool_use input; fall back to any text block.
	var raw string
	for _, c := range resp.Content {
		if c.Type == "tool_use" && c.Name == recordLineItemsTool && len(c.Input) > 0 {
			raw = string(c.Input)
			break
		}
	}
	if raw == "" {
		raw = resp.Content[0].Text
	}
	items, perr := parseLineItemsResponse(raw)
	recordExchange("anthropic", l.Model, prompt, raw, len(items), perr)
	if perr != nil {
		return nil, raw, fmt.Errorf("anthropic: %w", perr)
	}
	return items, raw, nil
}

var _ receipt.LLMProvider = (*AnthropicLLM)(nil)
