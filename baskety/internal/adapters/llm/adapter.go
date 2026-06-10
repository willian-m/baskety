package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/willian-m/baskety/internal/receipt"
)

// lineItemJSON is the JSON shape we ask every model to emit.
type lineItemJSON struct {
	Name             *string  `json:"name"`
	Brand            *string  `json:"brand"`
	Quantity         *float64 `json:"quantity"`
	Unit             *string  `json:"unit"`
	PricePerUnitMinor *int64  `json:"price_per_unit_minor"`
	Currency         *string  `json:"currency"`
	StoreName        *string  `json:"store_name"`
	Confidence       *float64 `json:"confidence"`
	RawText          *string  `json:"raw_text"`
}

const parsePrompt = `You are a receipt parser. Given the raw OCR text of a grocery receipt, extract each purchased line item. Respond with ONLY a JSON array (no prose, no markdown fences). Each element must have these fields:
- name (string): product name
- brand (string or null)
- quantity (number or null)
- unit (string or null, e.g. "kg", "L", "ea")
- price_per_unit_minor (integer or null): price per unit in minor currency units (cents)
- currency (string or null, e.g. "USD")
- store_name (string or null)
- confidence (number 0..1)
- raw_text (string): the original receipt line

Receipt OCR text:
`

// toParsedLineItems converts the JSON array string into receipt line items.
func toParsedLineItems(jsonArray string) ([]receipt.ParsedLineItem, error) {
	jsonArray = extractJSONArray(jsonArray)
	var raw []lineItemJSON
	if err := json.Unmarshal([]byte(jsonArray), &raw); err != nil {
		return nil, fmt.Errorf("parsing line items JSON: %w", err)
	}
	out := make([]receipt.ParsedLineItem, 0, len(raw))
	for _, r := range raw {
		item := receipt.ParsedLineItem{
			ParsedName:       r.Name,
			ParsedBrand:      r.Brand,
			ParsedQuantity:   r.Quantity,
			ParsedUnit:       r.Unit,
			ParsedPriceMinor: r.PricePerUnitMinor,
			ParsedCurrency:   r.Currency,
			ParsedStoreName:  r.StoreName,
			ConfidenceScore:  r.Confidence,
		}
		if r.RawText != nil {
			item.RawText = *r.RawText
		} else if r.Name != nil {
			item.RawText = *r.Name
		}
		out = append(out, item)
	}
	return out, nil
}

// extractJSONArray strips markdown fences and leading prose, returning the
// substring from the first '[' to the last ']'.
func extractJSONArray(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	start := strings.Index(s, "[")
	end := strings.LastIndex(s, "]")
	if start >= 0 && end > start {
		return s[start : end+1]
	}
	return s
}

func doJSONPost(ctx context.Context, url string, headers map[string]string, body any) ([]byte, error) {
	buf, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshalling request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(buf))
	if err != nil {
		return nil, fmt.Errorf("building request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http post: %w", err)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("upstream status %d: %s", resp.StatusCode, string(data))
	}
	return data, nil
}

// OllamaLLM calls a local Ollama server's generate endpoint.
type OllamaLLM struct {
	BaseURL string
	Model   string
}

func NewOllamaLLM(baseURL, model string) *OllamaLLM {
	if baseURL == "" {
		baseURL = "http://localhost:11434"
	}
	if model == "" {
		model = "llama3"
	}
	return &OllamaLLM{BaseURL: strings.TrimRight(baseURL, "/"), Model: model}
}

func (l *OllamaLLM) ParseReceipt(ctx context.Context, ocrText string) ([]receipt.ParsedLineItem, error) {
	reqBody := map[string]any{
		"model":  l.Model,
		"prompt": parsePrompt + ocrText,
		"stream": false,
		"format": "json",
	}
	data, err := doJSONPost(ctx, l.BaseURL+"/api/generate", nil, reqBody)
	if err != nil {
		return nil, fmt.Errorf("ollama: %w", err)
	}
	var resp struct {
		Response string `json:"response"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("ollama decode: %w", err)
	}
	return toParsedLineItems(resp.Response)
}

var _ receipt.LLMProvider = (*OllamaLLM)(nil)
