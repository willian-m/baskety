package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

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
	slog.Debug("anthropic request", "model", l.Model, "prompt_len", len(parsePrompt)+len(ocrText))
	reqBody := map[string]any{
		"model":      l.Model,
		"max_tokens": 4096,
		"system":     "You are a precise receipt-parsing assistant that outputs only a JSON array.",
		"messages": []map[string]string{
			{"role": "user", "content": parsePrompt + ocrText},
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
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, "", fmt.Errorf("anthropic decode: %w", err)
	}
	if len(resp.Content) == 0 {
		return nil, "", fmt.Errorf("anthropic: empty content")
	}
	raw := resp.Content[0].Text
	slog.Debug("anthropic response", "model", l.Model, "response", raw)
	items, err := toParsedLineItems(raw)
	return items, raw, err
}

var _ receipt.LLMProvider = (*AnthropicLLM)(nil)
