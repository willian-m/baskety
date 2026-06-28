package receipt

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/willian-m/baskety/gen/sqlc"
	"github.com/willian-m/baskety/internal/shared"
)

var ErrNotFound = errors.New("not found")

type pgRepository struct {
	q    *sqlc.Queries
	pool *pgxpool.Pool
}

func NewPgRepository(pool *pgxpool.Pool) Repository {
	return &pgRepository{q: sqlc.New(pool), pool: pool}
}

// --- pg helpers ---

// floatPtrToPgNumeric converts a *float64 to pgtype.Numeric (invalid when nil).
func floatPtrToPgNumeric(f *float64) pgtype.Numeric {
	if f == nil {
		return pgtype.Numeric{}
	}
	return shared.FloatToPgNumeric(*f)
}

// pgNumericToFloatPtr converts a pgtype.Numeric to *float64 (nil when invalid).
func pgNumericToFloatPtr(n pgtype.Numeric) *float64 {
	if !n.Valid || n.NaN || n.Int == nil {
		return nil
	}
	f := shared.PgNumericToFloat(n)
	return &f
}

// --- mappers ---

func toScan(row sqlc.ReceiptScan) *ReceiptScan {
	return &ReceiptScan{
		ID:              shared.PgToUUID(row.ID),
		HouseholdID:     shared.PgToUUID(row.HouseholdID),
		GroceryListID:   shared.PgToUUIDPtr(row.GroceryListID),
		RawImagePath:    row.RawImagePath,
		OCRText:         row.OcrText,
		LLMRawResponse:  row.LlmRawResponse,
		Status:          row.Status,
		ErrorMessage:    row.ErrorMessage,
		CreatedByUserID: shared.PgToUUID(row.CreatedByUserID),
		CreatedAt:       row.CreatedAt.Time,
		UpdatedAt:       row.UpdatedAt.Time,
	}
}

func toScanItem(row sqlc.ReceiptScanItem) *ReceiptScanItem {
	return &ReceiptScanItem{
		ID:                       shared.PgToUUID(row.ID),
		ReceiptScanID:            shared.PgToUUID(row.ReceiptScanID),
		RawText:                  row.RawText,
		ParsedName:               row.ParsedName,
		ParsedBrand:              row.ParsedBrand,
		ParsedQuantity:           pgNumericToFloatPtr(row.ParsedQuantity),
		ParsedUnit:               row.ParsedUnit,
		ParsedPriceMinor:         row.ParsedPricePerUnitMinor,
		ParsedTotalPriceMinor:    row.ParsedTotalPriceMinor,
		ParsedCurrency:           row.ParsedCurrency,
		ParsedStoreName:          row.ParsedStoreName,
		ConfidenceScore:          pgNumericToFloatPtr(row.ConfidenceScore),
		Status:                   row.Status,
		InventoryItemID:          shared.PgToUUIDPtr(row.InventoryItemID),
		CorrectedName:            row.CorrectedName,
		CorrectedBrand:           row.CorrectedBrand,
		CorrectedQuantity:        pgNumericToFloatPtr(row.CorrectedQuantity),
		CorrectedPriceMinor:      row.CorrectedPricePerUnitMinor,
		CorrectedTotalPriceMinor: row.CorrectedTotalPriceMinor,
		CorrectedCurrency:        row.CorrectedCurrency,
		CorrectedStoreName:       row.CorrectedStoreName,
		CorrectedUnit:            row.CorrectedUnit,
		CreatedAt:                row.CreatedAt.Time,
		UpdatedAt:                row.UpdatedAt.Time,
	}
}

func toPurchaseTransaction(row sqlc.PurchaseTransaction) *PurchaseTransaction {
	return &PurchaseTransaction{
		ID:                shared.PgToUUID(row.ID),
		HouseholdID:       shared.PgToUUID(row.HouseholdID),
		StoreID:           shared.PgToUUIDPtr(row.StoreID),
		GroceryListItemID: shared.PgToUUIDPtr(row.GroceryListItemID),
		ReceiptScanItemID: shared.PgToUUIDPtr(row.ReceiptScanItemID),
		CatalogEntryID:    shared.PgToUUIDPtr(row.CatalogEntryID),
		PricePerUnitMinor: row.PricePerUnitMinor,
		Currency:          row.Currency,
		Quantity:          pgNumericToFloatPtr(row.Quantity),
		PurchasedAt:       row.PurchasedAt.Time,
		CreatedAt:         row.CreatedAt.Time,
	}
}

// --- scans ---

func (r *pgRepository) CreateScan(ctx context.Context, householdID uuid.UUID, groceryListID *uuid.UUID, imagePath string, createdBy uuid.UUID) (*ReceiptScan, error) {
	row, err := r.q.CreateReceiptScan(ctx, sqlc.CreateReceiptScanParams{
		HouseholdID:     shared.UUIDToPg(householdID),
		GroceryListID:   shared.UUIDPtrToPg(groceryListID),
		RawImagePath:    imagePath,
		CreatedByUserID: shared.UUIDToPg(createdBy),
	})
	if err != nil {
		return nil, fmt.Errorf("create scan: %w", err)
	}
	return toScan(row), nil
}

func (r *pgRepository) GetScan(ctx context.Context, id uuid.UUID) (*ReceiptScan, error) {
	row, err := r.q.GetReceiptScanByID(ctx, shared.UUIDToPg(id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get scan: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get scan: %w", err)
	}
	return toScan(row), nil
}

func (r *pgRepository) ListScansByHousehold(ctx context.Context, householdID uuid.UUID) ([]*ReceiptScan, error) {
	rows, err := r.q.ListReceiptScansByHousehold(ctx, shared.UUIDToPg(householdID))
	if err != nil {
		return nil, fmt.Errorf("list scans: %w", err)
	}
	out := make([]*ReceiptScan, len(rows))
	for i, row := range rows {
		out[i] = toScan(row)
	}
	return out, nil
}

func (r *pgRepository) UpdateScanStatus(ctx context.Context, id uuid.UUID, status string, errMsg *string) (*ReceiptScan, error) {
	row, err := r.q.UpdateReceiptScanStatus(ctx, sqlc.UpdateReceiptScanStatusParams{
		ID:           shared.UUIDToPg(id),
		Status:       status,
		ErrorMessage: errMsg,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("update scan status: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("update scan status: %w", err)
	}
	return toScan(row), nil
}

func (r *pgRepository) SetOCRResult(ctx context.Context, id uuid.UUID, ocrText string) (*ReceiptScan, error) {
	row, err := r.q.SetReceiptScanOCRResult(ctx, sqlc.SetReceiptScanOCRResultParams{
		ID:      shared.UUIDToPg(id),
		OcrText: &ocrText,
	})
	if err != nil {
		return nil, fmt.Errorf("set ocr result: %w", err)
	}
	return toScan(row), nil
}

func (r *pgRepository) SetLLMResult(ctx context.Context, id uuid.UUID, llmRaw string) (*ReceiptScan, error) {
	row, err := r.q.SetReceiptScanLLMResult(ctx, sqlc.SetReceiptScanLLMResultParams{
		ID:             shared.UUIDToPg(id),
		LlmRawResponse: &llmRaw,
	})
	if err != nil {
		return nil, fmt.Errorf("set llm result: %w", err)
	}
	return toScan(row), nil
}

// --- scan items ---

func (r *pgRepository) CreateScanItem(ctx context.Context, scanID uuid.UUID, item ParsedLineItem) (*ReceiptScanItem, error) {
	row, err := r.q.CreateReceiptScanItem(ctx, sqlc.CreateReceiptScanItemParams{
		ReceiptScanID:           shared.UUIDToPg(scanID),
		RawText:                 item.RawText,
		ParsedName:              item.ParsedName,
		ParsedBrand:             item.ParsedBrand,
		ParsedQuantity:          floatPtrToPgNumeric(item.ParsedQuantity),
		ParsedUnit:              item.ParsedUnit,
		ParsedPricePerUnitMinor: item.ParsedPriceMinor,
		ParsedTotalPriceMinor:   item.ParsedTotalPriceMinor,
		ParsedCurrency:          item.ParsedCurrency,
		ParsedStoreName:         item.ParsedStoreName,
		ConfidenceScore:         floatPtrToPgNumeric(item.ConfidenceScore),
	})
	if err != nil {
		return nil, fmt.Errorf("create scan item: %w", err)
	}
	return toScanItem(row), nil
}

func (r *pgRepository) ListScanItems(ctx context.Context, scanID uuid.UUID) ([]*ReceiptScanItem, error) {
	rows, err := r.q.ListReceiptScanItems(ctx, shared.UUIDToPg(scanID))
	if err != nil {
		return nil, fmt.Errorf("list scan items: %w", err)
	}
	out := make([]*ReceiptScanItem, len(rows))
	for i, row := range rows {
		out[i] = toScanItem(row)
	}
	return out, nil
}

func (r *pgRepository) UpdateScanItem(ctx context.Context, id uuid.UUID, req UpdateScanItemRequest) (*ReceiptScanItem, error) {
	row, err := r.q.UpdateReceiptScanItemStatus(ctx, sqlc.UpdateReceiptScanItemStatusParams{
		ID:                         shared.UUIDToPg(id),
		Status:                     req.Status,
		CorrectedName:              req.CorrectedName,
		CorrectedBrand:             req.CorrectedBrand,
		CorrectedQuantity:          floatPtrToPgNumeric(req.CorrectedQuantity),
		CorrectedPricePerUnitMinor: req.CorrectedPriceMinor,
		CorrectedTotalPriceMinor:   req.CorrectedTotalPriceMinor,
		CorrectedCurrency:          req.CorrectedCurrency,
		CorrectedStoreName:         req.CorrectedStoreName,
		CorrectedUnit:              req.CorrectedUnit,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("update scan item: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("update scan item: %w", err)
	}
	return toScanItem(row), nil
}

// LinkScanItemToInventory links a scan item to an inventory item. When unit is
// non-nil it also sets corrected_unit, so the unit is forced to the one already
// stored on the inventory item (the receipt's unit is kept in parsed_unit).
func (r *pgRepository) LinkScanItemToInventory(ctx context.Context, scanItemID, inventoryItemID uuid.UUID, unit *string) error {
	if err := r.q.LinkReceiptScanItemToInventory(ctx, sqlc.LinkReceiptScanItemToInventoryParams{
		ID:              shared.UUIDToPg(scanItemID),
		InventoryItemID: shared.UUIDToPg(inventoryItemID),
		CorrectedUnit:   unit,
	}); err != nil {
		return fmt.Errorf("link scan item to inventory: %w", err)
	}
	return nil
}

// --- purchase transactions ---

// CreatePurchaseTransaction records a purchase derived from an accepted/corrected
// scan item. Price, currency, and quantity are taken from the corrected values
// when present, otherwise from the parsed values.
func (r *pgRepository) CreatePurchaseTransaction(ctx context.Context, householdID uuid.UUID, scanItemID uuid.UUID, purchasedAt time.Time) (*PurchaseTransaction, error) {
	si, gerr := r.getScanItem(ctx, scanItemID)
	if gerr != nil {
		return nil, gerr
	}

	price := si.ParsedPriceMinor
	if si.CorrectedPriceMinor != nil {
		price = si.CorrectedPriceMinor
	}
	qty := si.ParsedQuantity
	if si.CorrectedQuantity != nil {
		qty = si.CorrectedQuantity
	}
	currency := ""
	if si.ParsedCurrency != nil {
		currency = *si.ParsedCurrency
	}
	if si.CorrectedCurrency != nil {
		currency = *si.CorrectedCurrency
	}

	row, err := r.q.CreatePurchaseTransaction(ctx, sqlc.CreatePurchaseTransactionParams{
		HouseholdID:       shared.UUIDToPg(householdID),
		ReceiptScanItemID: shared.UUIDToPg(scanItemID),
		PricePerUnitMinor: price,
		Currency:          currency,
		Quantity:          floatPtrToPgNumeric(qty),
		PurchasedAt:       pgtype.Timestamptz{Time: purchasedAt, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("create purchase transaction: %w", err)
	}
	return toPurchaseTransaction(row), nil
}

// getScanItem reads a single receipt scan item by ID via raw SQL, since sqlc
// only generates a list query for scan items.
func (r *pgRepository) getScanItem(ctx context.Context, id uuid.UUID) (*ReceiptScanItem, error) {
	const q = `SELECT id, receipt_scan_id, raw_text, parsed_name, parsed_brand,
		parsed_quantity, parsed_unit, parsed_price_per_unit_minor, parsed_total_price_minor,
		parsed_currency, parsed_store_name, confidence_score, status, inventory_item_id,
		corrected_name, corrected_brand, corrected_quantity,
		corrected_price_per_unit_minor, corrected_total_price_minor, corrected_currency,
		corrected_store_name, corrected_unit, created_at, updated_at
		FROM receipt_scan_items WHERE id = $1`
	var row sqlc.ReceiptScanItem
	err := r.pool.QueryRow(ctx, q, shared.UUIDToPg(id)).Scan(
		&row.ID, &row.ReceiptScanID, &row.RawText, &row.ParsedName, &row.ParsedBrand,
		&row.ParsedQuantity, &row.ParsedUnit, &row.ParsedPricePerUnitMinor, &row.ParsedTotalPriceMinor,
		&row.ParsedCurrency, &row.ParsedStoreName, &row.ConfidenceScore, &row.Status, &row.InventoryItemID,
		&row.CorrectedName, &row.CorrectedBrand, &row.CorrectedQuantity,
		&row.CorrectedPricePerUnitMinor, &row.CorrectedTotalPriceMinor, &row.CorrectedCurrency,
		&row.CorrectedStoreName, &row.CorrectedUnit, &row.CreatedAt, &row.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get scan item: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get scan item: %w", err)
	}
	return toScanItem(row), nil
}
