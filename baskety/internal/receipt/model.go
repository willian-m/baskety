package receipt

import (
	"time"

	"github.com/google/uuid"
)

// Receipt scan status values.
const (
	StatusUploading     = "uploading"
	StatusOCRProcessing = "ocr_processing"
	StatusLLMProcessing = "llm_processing"
	StatusPendingReview = "pending_review"
	StatusCommitted     = "committed"
	StatusFailed        = "failed"
)

// Receipt scan item status values.
const (
	ItemStatusPending   = "pending"
	ItemStatusAccepted  = "accepted"
	ItemStatusRejected  = "rejected"
	ItemStatusCorrected = "corrected"
)

type ReceiptScan struct {
	ID              uuid.UUID
	HouseholdID     uuid.UUID
	GroceryListID   *uuid.UUID
	RawImagePath    string
	OCRText         *string
	LLMRawResponse  *string
	Status          string
	ErrorMessage    *string
	CreatedByUserID uuid.UUID
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type ReceiptScanItem struct {
	ID                       uuid.UUID
	ReceiptScanID            uuid.UUID
	RawText                  string
	ParsedName               *string
	ParsedBrand              *string
	ParsedQuantity           *float64
	ParsedUnit               *string
	ParsedPriceMinor         *int64
	ParsedTotalPriceMinor    *int64
	ParsedCurrency           *string
	ParsedStoreName          *string
	ConfidenceScore          *float64
	Status                   string
	InventoryItemID          *uuid.UUID
	CorrectedName            *string
	CorrectedBrand           *string
	CorrectedQuantity        *float64
	CorrectedPriceMinor      *int64
	CorrectedTotalPriceMinor *int64
	CorrectedCurrency        *string
	CorrectedStoreName       *string
	CorrectedUnit            *string
	CreatedAt                time.Time
	UpdatedAt                time.Time
}

type PurchaseTransaction struct {
	ID                uuid.UUID
	HouseholdID       uuid.UUID
	StoreID           *uuid.UUID
	GroceryListItemID *uuid.UUID
	ReceiptScanItemID *uuid.UUID
	CatalogEntryID    *uuid.UUID
	PricePerUnitMinor *int64
	Currency          string
	Quantity          *float64
	PurchasedAt       time.Time
	CreatedAt         time.Time
}
