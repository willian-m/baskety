package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"

	"github.com/willian-m/baskety/internal/receipt"
	"github.com/willian-m/baskety/internal/settings"
)

// lineItemJSON is the JSON shape we ask every model to emit.
type lineItemJSON struct {
	Name              *string  `json:"name"`
	Brand             *string  `json:"brand"`
	Quantity          *float64 `json:"quantity"`
	Unit              *string  `json:"unit"`
	PricePerUnitMinor *int64   `json:"price_per_unit_minor"`
	TotalPriceMinor   *int64   `json:"total_price_minor"`
	Currency          *string  `json:"currency"`
	StoreName         *string  `json:"store_name"`
	Confidence        *float64 `json:"confidence"`
	RawText           *string  `json:"raw_text"`
}

// recordLineItemsTool is the name of the structured-output tool/function every
// provider is asked to fill. Forcing the model to emit the tool's arguments
// (an object matching lineItemsResultSchema) is far more reliable than asking
// for free-form JSON, which models often wrap in prose or an unexpected object.
const recordLineItemsTool = "record_line_items"

const parsePrompt = `You are an expert grocery-receipt parser. Extract every purchased line item from the raw OCR text below by calling the ` + recordLineItemsTool + ` tool with one entry per item. Think like a shopper who knows these products — interpret aggressively, do not transcribe literally.

LANGUAGE
- Detect the receipt's language from the text (it is often Brazilian Portuguese, but may be any language) and interpret EVERYTHING in that language.
- Output product names in the receipt's own language. Do NOT translate to English (e.g. keep "Iogurte", "Frango", "Chá Preto").

FIX OCR ERRORS
The text is OCR output and is frequently garbled. Common character confusions you must reverse when a token does not form a sensible word:
  1 <-> I <-> l    0 <-> O    5 <-> S    6 <-> G    8 <-> B    2 <-> Z    N <-> M    rn <-> m
So "1706" is almost certainly "170G", and "1OG"/"IOG" is the product abbreviation "Iogurte", NOT the quantity 1.
Receipts also abbreviate product names heavily; expand them to the full common product name (a token may be only a prefix). Portuguese examples:
  "IOG" -> Iogurte,  "PEITO FGO" -> Peito de Frango,  "CHA PTO" -> Chá Preto,  "FGO" -> Frango,
  "DESF" -> Desfiado,  "CONG" -> Congelado,  "PROBIO" -> Probiótico,  "TOMATE ITAL" -> Tomate.

NAME vs BRAND
- "brand" is the manufacturer, usually a standalone uppercase token (e.g. BATAVO, SADIA, NESTLE, LEÃO). Put it in "brand", NOT in "name".
- "name" is the product type only (e.g. "Iogurte", "Peito de Frango"). Never put the brand in the name.
- If the line embeds a package size like "170G", "2L", "400G", APPEND it to the name (e.g. "Iogurte 170g"). The size is part of the name, NOT the purchase quantity.

QUANTITY / UNIT
- "quantity" is HOW MANY were purchased, from the receipt's quantity column — NOT the package size in the name.
- For a normal packaged item with no explicit quantity, use quantity 1 and unit "ea".
- For items sold by weight, use the printed weight as the quantity with its unit (e.g. quantity 0.4, unit "kg").
- A leading abbreviation that looks like a number after OCR damage (e.g. "1OG") is the product, never the quantity.

PRICES (lines may show: quantity, unit price, and line total, where total = quantity x unit price)
- price_per_unit_minor: price for ONE unit, in MINOR currency units (cents/centavos).
- total_price_minor: the line total, in minor currency units.
- Brazilian receipts use "R$" and a comma decimal separator: "4,50" means 4 reais 50 centavos = 450 minor units; "12,90" = 1290. Convert every price to integer minor units (multiply the major value by 100).
- Read each price AS PRINTED into its field; the system derives a missing one when possible. Always try to fill at least the line total.
- currency: the ISO code you infer (e.g. "BRL" for R$, "USD" for $).

CONFIDENCE
- ALWAYS set "confidence" (0..1). Use a LOWER value (<= 0.6) whenever you inferred, expanded, or corrected the name; use a high value only when the line is clearly legible.

OTHER FIELDS
- store_name: the store/market name if present, else null.
- raw_text: the original OCR line, completely unmodified.

Receipt OCR text:
`

// lineItemsResultSchema is the JSON Schema for the tool/structured output the
// models fill: an object with an "items" array. Rooting the result in an object
// (rather than a bare array) matches what tool-calling and structured-output
// APIs require, and eliminates the "object vs array" parse failures we saw when
// asking for free-form JSON. Nullable fields use ["type","null"] unions.
func lineItemsResultSchema() map[string]any {
	str := []string{"string", "null"}
	num := []string{"number", "null"}
	intt := []string{"integer", "null"}
	lineItem := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"name":                 map[string]any{"type": "string", "description": "product type in the receipt's language, OCR-corrected and abbreviations expanded, with any package size appended (e.g. 'Iogurte 170g'); never includes the brand"},
			"brand":                map[string]any{"type": str, "description": "manufacturer/brand (e.g. Batavo, Sadia), or null"},
			"quantity":             map[string]any{"type": num, "description": "how many were purchased (1 for a single packaged item; the weight for items sold by weight), NOT the package size"},
			"unit":                 map[string]any{"type": str, "description": "unit of the quantity/per-unit price, e.g. 'ea', 'kg', 'L'"},
			"price_per_unit_minor": map[string]any{"type": intt, "description": "price for ONE unit, in minor currency units (centavos/cents); '4,50' -> 450"},
			"total_price_minor":    map[string]any{"type": intt, "description": "line total in minor currency units (centavos/cents); '12,90' -> 1290"},
			"currency":             map[string]any{"type": str, "description": "ISO code inferred from the symbol, e.g. 'BRL' for R$"},
			"store_name":           map[string]any{"type": str, "description": "store/market name if present, else null"},
			"confidence":           map[string]any{"type": "number", "description": "0..1; <=0.6 when the name was inferred, expanded or OCR-corrected"},
			"raw_text":             map[string]any{"type": "string", "description": "original OCR line, unmodified"},
		},
		// All fields are required (nullable ones may be null) to nudge the model to
		// consider and populate quantity/unit/prices/confidence rather than omit them.
		"required": []string{"name", "brand", "quantity", "unit", "price_per_unit_minor", "total_price_minor", "currency", "store_name", "confidence", "raw_text"},
	}
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"items": map[string]any{
				"type":        "array",
				"description": "one entry per purchased line item",
				"items":       lineItem,
			},
		},
		"required": []string{"items"},
	}
}

// toParsedLineItems converts the JSON array string into receipt line items.
func toParsedLineItems(jsonArray string) ([]receipt.ParsedLineItem, error) {
	jsonArray = extractJSONArray(jsonArray)
	var raw []lineItemJSON
	if err := json.Unmarshal([]byte(jsonArray), &raw); err != nil {
		return nil, fmt.Errorf("parsing line items JSON: %w", err)
	}
	out := make([]receipt.ParsedLineItem, 0, len(raw))
	for _, r := range raw {
		unitPrice, totalPrice := reconcilePrices(r.PricePerUnitMinor, r.TotalPriceMinor, r.Quantity)
		item := receipt.ParsedLineItem{
			ParsedName:            r.Name,
			ParsedBrand:           r.Brand,
			ParsedQuantity:        r.Quantity,
			ParsedUnit:            r.Unit,
			ParsedPriceMinor:      unitPrice,
			ParsedTotalPriceMinor: totalPrice,
			ParsedCurrency:        r.Currency,
			ParsedStoreName:       r.StoreName,
			ConfidenceScore:       r.Confidence,
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

// reconcilePrices fills in a missing per-unit or line-total price using the
// other value and the quantity. Receipts print qty, unit price, and total
// where total = qty x unit price, but OCR/LLM extraction may only capture one
// of the two prices. We never overwrite a value the model already provided.
func reconcilePrices(unitPrice, totalPrice *int64, quantity *float64) (*int64, *int64) {
	hasQty := quantity != nil && *quantity > 0
	if unitPrice == nil && totalPrice != nil && hasQty {
		v := int64(math.Round(float64(*totalPrice) / *quantity))
		unitPrice = &v
	}
	if totalPrice == nil && unitPrice != nil && hasQty {
		v := int64(math.Round(float64(*unitPrice) * *quantity))
		totalPrice = &v
	}
	return unitPrice, totalPrice
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

// extractJSONObject returns the substring from the first '{' to the last '}'.
func extractJSONObject(s string) string {
	start := strings.IndexByte(s, '{')
	end := strings.LastIndexByte(s, '}')
	if start >= 0 && end > start {
		return s[start : end+1]
	}
	return s
}

// parseLineItemsResponse turns a model's raw output into line items. It is
// tolerant of the three shapes models produce despite instructions: a bare
// array, an object wrapping the array under some key (e.g. {"items": [...]}),
// or the tool/structured-output object itself. This is the single parsing entry
// point used by every provider so they all benefit from the same resilience.
func parseLineItemsResponse(content string) ([]receipt.ParsedLineItem, error) {
	// 1. Bare array (possibly fenced / prefixed with prose).
	if items, err := toParsedLineItems(content); err == nil {
		return items, nil
	}
	// 2. Object wrapper: find the first array-valued property and parse it.
	var wrapper map[string]json.RawMessage
	if err := json.Unmarshal([]byte(extractJSONObject(content)), &wrapper); err == nil {
		for _, v := range wrapper {
			trimmed := strings.TrimSpace(string(v))
			if strings.HasPrefix(trimmed, "[") {
				if items, err := toParsedLineItems(trimmed); err == nil {
					return items, nil
				}
			}
		}
	}
	return nil, fmt.Errorf("could not extract line items from response")
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

func (l *OllamaLLM) ParseReceipt(ctx context.Context, ocrText string) ([]receipt.ParsedLineItem, string, error) {
	prompt := parsePrompt + ocrText
	// Ollama structured outputs: passing a JSON Schema as "format" constrains the
	// model to emit a matching object, so the response is the items object rather
	// than free-form text. (Plain "json" only guaranteed valid JSON, not shape.)
	reqBody := map[string]any{
		"model":  l.Model,
		"prompt": prompt,
		"stream": false,
		"format": lineItemsResultSchema(),
	}
	data, err := doJSONPost(ctx, l.BaseURL+"/api/generate", nil, reqBody)
	if err != nil {
		return nil, "", fmt.Errorf("ollama: %w", err)
	}
	var resp struct {
		Response string `json:"response"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, "", fmt.Errorf("ollama decode: %w", err)
	}
	items, perr := parseLineItemsResponse(resp.Response)
	recordExchange("ollama", l.Model, prompt, resp.Response, len(items), perr)
	if perr != nil {
		return nil, resp.Response, fmt.Errorf("ollama: %w", perr)
	}
	return items, resp.Response, nil
}

var _ receipt.LLMProvider = (*OllamaLLM)(nil)

// NewFromConfig builds the right LLMProvider from a stored settings config.
func NewFromConfig(cfg *settings.LLMProviderConfig) (receipt.LLMProvider, error) {
	var apiKey, endpoint string
	if cfg.APIKeyEncrypted != nil {
		apiKey = *cfg.APIKeyEncrypted
	}
	if cfg.EndpointURL != nil {
		endpoint = *cfg.EndpointURL
	}
	switch cfg.Provider {
	case "ollama":
		return NewOllamaLLM(endpoint, cfg.Model), nil
	case "openai":
		return NewOpenAILLM(apiKey, cfg.Model), nil
	case "anthropic":
		return NewAnthropicLLM(apiKey, cfg.Model), nil
	default:
		return nil, fmt.Errorf("unknown LLM provider %q", cfg.Provider)
	}
}
