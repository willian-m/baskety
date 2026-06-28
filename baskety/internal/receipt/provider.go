package receipt

import (
	"context"

	"github.com/google/uuid"
)

// OCRProvider extracts raw text from a receipt image. Implementations are
// pluggable (Tesseract, cloud OCR, etc.) so self-hosters can substitute models.
type OCRProvider interface {
	ExtractText(ctx context.Context, imagePath string) (string, error)
}

// LLMProvider turns raw OCR text into structured line items. Implementations are
// pluggable (Ollama, OpenAI, Anthropic, ...).
type LLMProvider interface {
	// ParseReceipt returns the parsed line items and the raw response text from
	// the model, so callers can store or log the original output for debugging.
	ParseReceipt(ctx context.Context, ocrText string) ([]ParsedLineItem, string, error)
}

// InventoryLookup provides read-only access to a household's inventory items so
// the receipt pipeline can auto-match parsed line items to existing items and
// enforce their stored unit. Implemented by an adapter over the inventory repo
// (wired in main) to keep the receipt package decoupled from inventory.
type InventoryLookup interface {
	// HouseholdItems returns all (non-deleted) inventory items across the
	// household's inventories, used for name matching during processing.
	HouseholdItems(ctx context.Context, householdID uuid.UUID) ([]InventoryItemRef, error)
	// ItemUnit returns the stored unit of a single inventory item.
	ItemUnit(ctx context.Context, itemID uuid.UUID) (unit string, found bool, err error)
}

// InventoryItemRef is the minimal inventory item shape the receipt pipeline
// needs for matching and unit enforcement.
type InventoryItemRef struct {
	ID   uuid.UUID
	Name string
	Unit string
}

// LLMProviderResolver builds an LLMProvider for the given household, reading
// the household's configured default provider from the settings store. The
// resolver is called per-job so settings changes take effect immediately.
type LLMProviderResolver func(ctx context.Context, householdID uuid.UUID) (LLMProvider, error)

// ParsedLineItem is the structured output of LLM receipt parsing for a single
// line. All fields except RawText are optional pointers because the model may
// not be able to extract every field with confidence.
type ParsedLineItem struct {
	RawText               string
	ParsedName            *string
	ParsedBrand           *string
	ParsedQuantity        *float64
	ParsedUnit            *string
	ParsedPriceMinor      *int64
	ParsedTotalPriceMinor *int64
	ParsedCurrency        *string
	ParsedStoreName       *string
	ConfidenceScore       *float64
}
