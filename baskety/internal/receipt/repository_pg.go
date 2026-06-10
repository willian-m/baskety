package receipt

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/willian-m/baskety/gen/sqlc"
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

func uuidToPg(id uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: id, Valid: true}
}

func uuidPtrToPg(id *uuid.UUID) pgtype.UUID {
	if id == nil {
		return pgtype.UUID{}
	}
	return pgtype.UUID{Bytes: *id, Valid: true}
}

func pgToUUID(id pgtype.UUID) uuid.UUID {
	return uuid.UUID(id.Bytes)
}

func pgToUUIDPtr(id pgtype.UUID) *uuid.UUID {
	if !id.Valid {
		return nil
	}
	u := uuid.UUID(id.Bytes)
	return &u
}

func floatPtrToPgNumeric(f *float64) pgtype.Numeric {
	if f == nil {
		return pgtype.Numeric{}
	}
	var n pgtype.Numeric
	_ = n.Scan(fmt.Sprintf("%v", *f))
	return n
}

func pgNumericToFloatPtr(n pgtype.Numeric) *float64 {
	if !n.Valid || n.NaN {
		return nil
	}
	f := new(big.Float).SetInt(n.Int)
	if n.Exp != 0 {
		f.Mul(f, big.NewFloat(pow10(n.Exp)))
	}
	res, _ := f.Float64()
	return &res
}

func pow10(exp int32) float64 {
	r := 1.0
	if exp >= 0 {
		for i := int32(0); i < exp; i++ {
			r *= 10
		}
	} else {
		for i := int32(0); i < -exp; i++ {
			r /= 10
		}
	}
	return r
}

// --- mappers ---

func toScan(row sqlc.ReceiptScan) *ReceiptScan {
	return &ReceiptScan{
		ID:              pgToUUID(row.ID),
		HouseholdID:     pgToUUID(row.HouseholdID),
		GroceryListID:   pgToUUIDPtr(row.GroceryListID),
		RawImagePath:    row.RawImagePath,
		OCRText:         row.OcrText,
		LLMRawResponse:  row.LlmRawResponse,
		Status:          row.Status,
		ErrorMessage:    row.ErrorMessage,
		CreatedByUserID: pgToUUID(row.CreatedByUserID),
		CreatedAt:       row.CreatedAt.Time,
		UpdatedAt:       row.UpdatedAt.Time,
	}
}

func toScanItem(row sqlc.ReceiptScanItem) *ReceiptScanItem {
	return &ReceiptScanItem{
		ID:                  pgToUUID(row.ID),
		ReceiptScanID:       pgToUUID(row.ReceiptScanID),
		RawText:             row.RawText,
		ParsedName:          row.ParsedName,
		ParsedBrand:         row.ParsedBrand,
		ParsedQuantity:      pgNumericToFloatPtr(row.ParsedQuantity),
		ParsedUnit:          row.ParsedUnit,
		ParsedPriceMinor:    row.ParsedPricePerUnitMinor,
		ParsedCurrency:      row.ParsedCurrency,
		ParsedStoreName:     row.ParsedStoreName,
		ConfidenceScore:     pgNumericToFloatPtr(row.ConfidenceScore),
		Status:              row.Status,
		InventoryItemID:     pgToUUIDPtr(row.InventoryItemID),
		CorrectedName:       row.CorrectedName,
		CorrectedBrand:      row.CorrectedBrand,
		CorrectedQuantity:   pgNumericToFloatPtr(row.CorrectedQuantity),
		CorrectedPriceMinor: row.CorrectedPricePerUnitMinor,
		CorrectedCurrency:   row.CorrectedCurrency,
		CorrectedStoreName:  row.CorrectedStoreName,
		CreatedAt:           row.CreatedAt.Time,
		UpdatedAt:           row.UpdatedAt.Time,
	}
}

func toPurchaseTransaction(row sqlc.PurchaseTransaction) *PurchaseTransaction {
	return &PurchaseTransaction{
		ID:                pgToUUID(row.ID),
		HouseholdID:       pgToUUID(row.HouseholdID),
		StoreID:           pgToUUIDPtr(row.StoreID),
		GroceryListItemID: pgToUUIDPtr(row.GroceryListItemID),
		ReceiptScanItemID: pgToUUIDPtr(row.ReceiptScanItemID),
		CatalogEntryID:    pgToUUIDPtr(row.CatalogEntryID),
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
		HouseholdID:     uuidToPg(householdID),
		GroceryListID:   uuidPtrToPg(groceryListID),
		RawImagePath:    imagePath,
		CreatedByUserID: uuidToPg(createdBy),
	})
	if err != nil {
		return nil, fmt.Errorf("create scan: %w", err)
	}
	return toScan(row), nil
}

func (r *pgRepository) GetScan(ctx context.Context, id uuid.UUID) (*ReceiptScan, error) {
	row, err := r.q.GetReceiptScanByID(ctx, uuidToPg(id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get scan: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get scan: %w", err)
	}
	return toScan(row), nil
}

func (r *pgRepository) ListScansByHousehold(ctx context.Context, householdID uuid.UUID) ([]*ReceiptScan, error) {
	rows, err := r.q.ListReceiptScansByHousehold(ctx, uuidToPg(householdID))
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
		ID:           uuidToPg(id),
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
		ID:      uuidToPg(id),
		OcrText: &ocrText,
	})
	if err != nil {
		return nil, fmt.Errorf("set ocr result: %w", err)
	}
	return toScan(row), nil
}

func (r *pgRepository) SetLLMResult(ctx context.Context, id uuid.UUID, llmRaw string) (*ReceiptScan, error) {
	row, err := r.q.SetReceiptScanLLMResult(ctx, sqlc.SetReceiptScanLLMResultParams{
		ID:             uuidToPg(id),
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
		ReceiptScanID:           uuidToPg(scanID),
		RawText:                 item.RawText,
		ParsedName:              item.ParsedName,
		ParsedBrand:             item.ParsedBrand,
		ParsedQuantity:          floatPtrToPgNumeric(item.ParsedQuantity),
		ParsedUnit:              item.ParsedUnit,
		ParsedPricePerUnitMinor: item.ParsedPriceMinor,
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
	rows, err := r.q.ListReceiptScanItems(ctx, uuidToPg(scanID))
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
		ID:                         uuidToPg(id),
		Status:                     req.Status,
		CorrectedName:              req.CorrectedName,
		CorrectedBrand:             req.CorrectedBrand,
		CorrectedQuantity:          floatPtrToPgNumeric(req.CorrectedQuantity),
		CorrectedPricePerUnitMinor: req.CorrectedPriceMinor,
		CorrectedCurrency:          req.CorrectedCurrency,
		CorrectedStoreName:         req.CorrectedStoreName,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("update scan item: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("update scan item: %w", err)
	}
	return toScanItem(row), nil
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
		HouseholdID:       uuidToPg(householdID),
		ReceiptScanItemID: uuidToPg(scanItemID),
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
		parsed_quantity, parsed_unit, parsed_price_per_unit_minor, parsed_currency,
		parsed_store_name, confidence_score, status, inventory_item_id,
		corrected_name, corrected_brand, corrected_quantity,
		corrected_price_per_unit_minor, corrected_currency, corrected_store_name,
		created_at, updated_at
		FROM receipt_scan_items WHERE id = $1`
	var row sqlc.ReceiptScanItem
	err := r.pool.QueryRow(ctx, q, uuidToPg(id)).Scan(
		&row.ID, &row.ReceiptScanID, &row.RawText, &row.ParsedName, &row.ParsedBrand,
		&row.ParsedQuantity, &row.ParsedUnit, &row.ParsedPricePerUnitMinor, &row.ParsedCurrency,
		&row.ParsedStoreName, &row.ConfidenceScore, &row.Status, &row.InventoryItemID,
		&row.CorrectedName, &row.CorrectedBrand, &row.CorrectedQuantity,
		&row.CorrectedPricePerUnitMinor, &row.CorrectedCurrency, &row.CorrectedStoreName,
		&row.CreatedAt, &row.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get scan item: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get scan item: %w", err)
	}
	return toScanItem(row), nil
}
