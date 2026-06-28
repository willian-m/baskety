package llm

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/willian-m/baskety/internal/receipt"
)

// OpenAILLM calls the OpenAI chat completions API directly via net/http.
type OpenAILLM struct {
	APIKey string
	Model  string
}

func NewOpenAILLM(apiKey, model string) *OpenAILLM {
	if model == "" {
		model = "gpt-4o-mini"
	}
	return &OpenAILLM{APIKey: apiKey, Model: model}
}

func (l *OpenAILLM) ParseReceipt(ctx context.Context, ocrText string) ([]receipt.ParsedLineItem, string, error) {
	prompt := parsePrompt + ocrText
	// Force the model to call our function: its arguments are guaranteed to be a
	// JSON object matching the schema, which we parse directly. This avoids the
	// free-form-JSON shape failures (object vs array) seen with response_format.
	reqBody := map[string]any{
		"model": l.Model,
		"messages": []map[string]string{
			{"role": "system", "content": "You are a precise receipt-parsing assistant. Always call the " + recordLineItemsTool + " function."},
			{"role": "user", "content": prompt},
		},
		"tools": []map[string]any{{
			"type": "function",
			"function": map[string]any{
				"name":        recordLineItemsTool,
				"description": "Record the line items extracted from the receipt.",
				"parameters":  lineItemsResultSchema(),
			},
		}},
		"tool_choice": map[string]any{
			"type":     "function",
			"function": map[string]string{"name": recordLineItemsTool},
		},
	}
	headers := map[string]string{"Authorization": "Bearer " + l.APIKey}
	data, err := doJSONPost(ctx, "https://api.openai.com/v1/chat/completions", headers, reqBody)
	if err != nil {
		return nil, "", fmt.Errorf("openai: %w", err)
	}
	var resp struct {
		Choices []struct {
			Message struct {
				Content   string `json:"content"`
				ToolCalls []struct {
					Function struct {
						Arguments string `json:"arguments"`
					} `json:"function"`
				} `json:"tool_calls"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, "", fmt.Errorf("openai decode: %w", err)
	}
	if len(resp.Choices) == 0 {
		return nil, "", fmt.Errorf("openai: empty choices")
	}
	// Prefer the tool-call arguments; fall back to message content for servers
	// (or OpenAI-compatible endpoints) that ignore tool_choice.
	raw := resp.Choices[0].Message.Content
	if tc := resp.Choices[0].Message.ToolCalls; len(tc) > 0 && tc[0].Function.Arguments != "" {
		raw = tc[0].Function.Arguments
	}
	items, perr := parseLineItemsResponse(raw)
	recordExchange("openai", l.Model, prompt, raw, len(items), perr)
	if perr != nil {
		return nil, raw, fmt.Errorf("openai: %w", perr)
	}
	return items, raw, nil
}

var _ receipt.LLMProvider = (*OpenAILLM)(nil)
