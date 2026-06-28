package receipt

import "time"

// --- Requests ---

type UpdateScanItemRequest struct {
	Status                   string   `json:"status"`
	InventoryItemID          *string  `json:"inventory_item_id"`
	CorrectedName            *string  `json:"corrected_name"`
	CorrectedBrand           *string  `json:"corrected_brand"`
	CorrectedStoreName       *string  `json:"corrected_store_name"`
	CorrectedQuantity        *float64 `json:"corrected_quantity"`
	CorrectedPriceMinor      *int64   `json:"corrected_price_minor"`
	CorrectedTotalPriceMinor *int64   `json:"corrected_total_price_minor"`
	CorrectedCurrency        *string  `json:"corrected_currency"`
	CorrectedUnit            *string  `json:"corrected_unit"`
}

type CommitScanRequest struct {
	PurchasedAt time.Time `json:"purchased_at"`
}

// --- Responses ---

type ScanResponse struct {
	ID              string    `json:"id"`
	HouseholdID     string    `json:"household_id"`
	GroceryListID   *string   `json:"grocery_list_id"`
	RawImagePath    string    `json:"raw_image_path"`
	OCRText         *string   `json:"ocr_text"`
	LLMRawResponse  *string   `json:"llm_raw_response"`
	Status          string    `json:"status"`
	ErrorMessage    *string   `json:"error_message"`
	CreatedByUserID string    `json:"created_by_user_id"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type ScanItemResponse struct {
	ID                       string    `json:"id"`
	ReceiptScanID            string    `json:"receipt_scan_id"`
	RawText                  string    `json:"raw_text"`
	ParsedName               *string   `json:"parsed_name"`
	ParsedBrand              *string   `json:"parsed_brand"`
	ParsedQuantity           *float64  `json:"parsed_quantity"`
	ParsedUnit               *string   `json:"parsed_unit"`
	ParsedPriceMinor         *int64    `json:"parsed_price_minor"`
	ParsedTotalPriceMinor    *int64    `json:"parsed_total_price_minor"`
	ParsedCurrency           *string   `json:"parsed_currency"`
	ParsedStoreName          *string   `json:"parsed_store_name"`
	ConfidenceScore          *float64  `json:"confidence_score"`
	Status                   string    `json:"status"`
	InventoryItemID          *string   `json:"inventory_item_id"`
	CorrectedName            *string   `json:"corrected_name"`
	CorrectedBrand           *string   `json:"corrected_brand"`
	CorrectedQuantity        *float64  `json:"corrected_quantity"`
	CorrectedPriceMinor      *int64    `json:"corrected_price_minor"`
	CorrectedTotalPriceMinor *int64    `json:"corrected_total_price_minor"`
	CorrectedCurrency        *string   `json:"corrected_currency"`
	CorrectedStoreName       *string   `json:"corrected_store_name"`
	CorrectedUnit            *string   `json:"corrected_unit"`
	CreatedAt                time.Time `json:"created_at"`
	UpdatedAt                time.Time `json:"updated_at"`
}

func toScanResponse(m *ReceiptScan) *ScanResponse {
	var glID *string
	if m.GroceryListID != nil {
		s := m.GroceryListID.String()
		glID = &s
	}
	return &ScanResponse{
		ID:              m.ID.String(),
		HouseholdID:     m.HouseholdID.String(),
		GroceryListID:   glID,
		RawImagePath:    m.RawImagePath,
		OCRText:         m.OCRText,
		LLMRawResponse:  m.LLMRawResponse,
		Status:          m.Status,
		ErrorMessage:    m.ErrorMessage,
		CreatedByUserID: m.CreatedByUserID.String(),
		CreatedAt:       m.CreatedAt,
		UpdatedAt:       m.UpdatedAt,
	}
}

func toScanItemResponse(m *ReceiptScanItem) *ScanItemResponse {
	var invID *string
	if m.InventoryItemID != nil {
		s := m.InventoryItemID.String()
		invID = &s
	}
	return &ScanItemResponse{
		ID:                       m.ID.String(),
		ReceiptScanID:            m.ReceiptScanID.String(),
		RawText:                  m.RawText,
		ParsedName:               m.ParsedName,
		ParsedBrand:              m.ParsedBrand,
		ParsedQuantity:           m.ParsedQuantity,
		ParsedUnit:               m.ParsedUnit,
		ParsedPriceMinor:         m.ParsedPriceMinor,
		ParsedTotalPriceMinor:    m.ParsedTotalPriceMinor,
		ParsedCurrency:           m.ParsedCurrency,
		ParsedStoreName:          m.ParsedStoreName,
		ConfidenceScore:          m.ConfidenceScore,
		Status:                   m.Status,
		InventoryItemID:          invID,
		CorrectedName:            m.CorrectedName,
		CorrectedBrand:           m.CorrectedBrand,
		CorrectedQuantity:        m.CorrectedQuantity,
		CorrectedPriceMinor:      m.CorrectedPriceMinor,
		CorrectedTotalPriceMinor: m.CorrectedTotalPriceMinor,
		CorrectedCurrency:        m.CorrectedCurrency,
		CorrectedStoreName:       m.CorrectedStoreName,
		CorrectedUnit:            m.CorrectedUnit,
		CreatedAt:                m.CreatedAt,
		UpdatedAt:                m.UpdatedAt,
	}
}
