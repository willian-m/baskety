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

func (l *OpenAILLM) ParseReceipt(ctx context.Context, ocrText string) ([]receipt.ParsedLineItem, error) {
	reqBody := map[string]any{
		"model": l.Model,
		"messages": []map[string]string{
			{"role": "system", "content": "You are a precise receipt-parsing assistant that outputs only JSON."},
			{"role": "user", "content": parsePrompt + ocrText},
		},
		"response_format": map[string]string{"type": "json_object"},
	}
	headers := map[string]string{"Authorization": "Bearer " + l.APIKey}
	data, err := doJSONPost(ctx, "https://api.openai.com/v1/chat/completions", headers, reqBody)
	if err != nil {
		return nil, fmt.Errorf("openai: %w", err)
	}
	var resp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("openai decode: %w", err)
	}
	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("openai: empty choices")
	}
	return parseMaybeWrappedArray(resp.Choices[0].Message.Content)
}

// parseMaybeWrappedArray handles models that, when asked for a json_object,
// wrap the array under a key like {"items": [...]}. It first tries a bare array.
func parseMaybeWrappedArray(content string) ([]receipt.ParsedLineItem, error) {
	if items, err := toParsedLineItems(content); err == nil {
		return items, nil
	}
	var wrapper map[string]json.RawMessage
	if err := json.Unmarshal([]byte(extractJSONObject(content)), &wrapper); err == nil {
		for _, v := range wrapper {
			if items, err := toParsedLineItems(string(v)); err == nil {
				return items, nil
			}
		}
	}
	return nil, fmt.Errorf("could not extract line item array from response")
}

func extractJSONObject(s string) string {
	start := indexByte(s, '{')
	end := lastIndexByte(s, '}')
	if start >= 0 && end > start {
		return s[start : end+1]
	}
	return s
}

func indexByte(s string, b byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == b {
			return i
		}
	}
	return -1
}

func lastIndexByte(s string, b byte) int {
	for i := len(s) - 1; i >= 0; i-- {
		if s[i] == b {
			return i
		}
	}
	return -1
}

var _ receipt.LLMProvider = (*OpenAILLM)(nil)
