package receipt

import "context"

// OCRProvider extracts raw text from a receipt image. Implementations are
// pluggable (Tesseract, cloud OCR, etc.) so self-hosters can substitute models.
type OCRProvider interface {
	ExtractText(ctx context.Context, imagePath string) (string, error)
}

// LLMProvider turns raw OCR text into structured line items. Implementations are
// pluggable (Ollama, OpenAI, Anthropic, ...).
type LLMProvider interface {
	ParseReceipt(ctx context.Context, ocrText string) ([]ParsedLineItem, error)
}

// ParsedLineItem is the structured output of LLM receipt parsing for a single
// line. All fields except RawText are optional pointers because the model may
// not be able to extract every field with confidence.
type ParsedLineItem struct {
	RawText          string
	ParsedName       *string
	ParsedBrand      *string
	ParsedQuantity   *float64
	ParsedUnit       *string
	ParsedPriceMinor *int64
	ParsedCurrency   *string
	ParsedStoreName  *string
	ConfidenceScore  *float64
}
