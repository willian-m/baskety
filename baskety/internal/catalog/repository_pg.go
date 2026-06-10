package catalog

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"strings"

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

func toStore(row sqlc.Store) *Store {
	return &Store{
		ID:               pgToUUID(row.ID),
		Name:             row.Name,
		ChainName:        row.ChainName,
		Address:          row.Address,
		CanonicalStoreID: pgToUUIDPtr(row.CanonicalStoreID),
		CreatedAt:        row.CreatedAt.Time,
		UpdatedAt:        row.UpdatedAt.Time,
	}
}

func toCatalogEntry(row sqlc.CatalogEntry) *CatalogEntry {
	return &CatalogEntry{
		ID:               pgToUUID(row.ID),
		Name:             row.Name,
		Brand:            row.Brand,
		Unit:             row.Unit,
		Category:         row.Category,
		Scope:            row.Scope,
		HouseholdID:      pgToUUIDPtr(row.HouseholdID),
		CanonicalEntryID: pgToUUIDPtr(row.CanonicalEntryID),
		CreatedAt:        row.CreatedAt.Time,
		UpdatedAt:        row.UpdatedAt.Time,
	}
}

func toTransaction(row sqlc.PurchaseTransaction) *PurchaseTransaction {
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

// --- stores ---

func (r *pgRepository) CreateStore(ctx context.Context, name string, chainName, address *string) (*Store, error) {
	row, err := r.q.CreateStore(ctx, sqlc.CreateStoreParams{
		Name:      name,
		ChainName: chainName,
		Address:   address,
	})
	if err != nil {
		return nil, fmt.Errorf("create store: %w", err)
	}
	return toStore(row), nil
}

func (r *pgRepository) GetStore(ctx context.Context, id uuid.UUID) (*Store, error) {
	row, err := r.q.GetStoreByID(ctx, uuidToPg(id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get store: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get store: %w", err)
	}
	return toStore(row), nil
}

func (r *pgRepository) ListStores(ctx context.Context) ([]*Store, error) {
	rows, err := r.q.ListStores(ctx)
	if err != nil {
		return nil, fmt.Errorf("list stores: %w", err)
	}
	out := make([]*Store, len(rows))
	for i, row := range rows {
		out[i] = toStore(row)
	}
	return out, nil
}

// UpsertStore looks for an existing canonical store with a case-insensitive name
// match; if none exists it creates one. The stores table has no unique
// constraint on name, so dedup is done at the application layer.
func (r *pgRepository) UpsertStore(ctx context.Context, name string, chainName, address *string) (*Store, error) {
	existing, err := r.ListStores(ctx)
	if err != nil {
		return nil, err
	}
	for _, s := range existing {
		if strings.EqualFold(s.Name, name) {
			return s, nil
		}
	}
	return r.CreateStore(ctx, name, chainName, address)
}

// --- catalog entries ---

func (r *pgRepository) CreateCatalogEntry(ctx context.Context, householdID *uuid.UUID, name string, brand, unit, category *string, scope string) (*CatalogEntry, error) {
	row, err := r.q.CreateCatalogEntry(ctx, sqlc.CreateCatalogEntryParams{
		Name:        name,
		Brand:       brand,
		Unit:        unit,
		Category:    category,
		Scope:       scope,
		HouseholdID: uuidPtrToPg(householdID),
	})
	if err != nil {
		return nil, fmt.Errorf("create catalog entry: %w", err)
	}
	return toCatalogEntry(row), nil
}

func (r *pgRepository) GetCatalogEntry(ctx context.Context, id uuid.UUID) (*CatalogEntry, error) {
	row, err := r.q.GetCatalogEntryByID(ctx, uuidToPg(id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get catalog entry: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get catalog entry: %w", err)
	}
	return toCatalogEntry(row), nil
}

func (r *pgRepository) ListCatalogEntries(ctx context.Context, householdID uuid.UUID) ([]*CatalogEntry, error) {
	rows, err := r.q.ListCatalogEntriesByHousehold(ctx, uuidToPg(householdID))
	if err != nil {
		return nil, fmt.Errorf("list catalog entries: %w", err)
	}
	out := make([]*CatalogEntry, len(rows))
	for i, row := range rows {
		out[i] = toCatalogEntry(row)
	}
	return out, nil
}

// UpsertCatalogEntry dedups on case-insensitive (name, brand) within the
// household scope (entries visible to the household, including public ones).
func (r *pgRepository) UpsertCatalogEntry(ctx context.Context, householdID *uuid.UUID, name string, brand, unit, category *string, scope string) (*CatalogEntry, error) {
	if householdID != nil {
		existing, err := r.ListCatalogEntries(ctx, *householdID)
		if err != nil {
			return nil, err
		}
		for _, e := range existing {
			if strings.EqualFold(e.Name, name) && sameStrPtr(e.Brand, brand) {
				return e, nil
			}
		}
	}
	return r.CreateCatalogEntry(ctx, householdID, name, brand, unit, category, scope)
}

func sameStrPtr(a, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return strings.EqualFold(*a, *b)
}

// --- transactions ---

func (r *pgRepository) GetPurchaseTransaction(ctx context.Context, id uuid.UUID) (*PurchaseTransaction, error) {
	row, err := r.q.GetPurchaseTransactionByID(ctx, uuidToPg(id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get purchase transaction: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get purchase transaction: %w", err)
	}
	return toTransaction(row), nil
}

// UpdatePurchaseTransactionRefs sets store_id and catalog_entry_id on a
// transaction. No sqlc query exists for this, so it uses a direct pool query.
func (r *pgRepository) UpdatePurchaseTransactionRefs(ctx context.Context, id uuid.UUID, storeID, catalogEntryID *uuid.UUID) error {
	const q = `UPDATE purchase_transactions SET store_id = $2, catalog_entry_id = $3 WHERE id = $1`
	_, err := r.pool.Exec(ctx, q, uuidToPg(id), uuidPtrToPg(storeID), uuidPtrToPg(catalogEntryID))
	if err != nil {
		return fmt.Errorf("update purchase transaction refs: %w", err)
	}
	return nil
}

func (r *pgRepository) ListTransactionsByHousehold(ctx context.Context, householdID uuid.UUID) ([]*PurchaseTransaction, error) {
	rows, err := r.q.ListPurchaseTransactionsByHousehold(ctx, uuidToPg(householdID))
	if err != nil {
		return nil, fmt.Errorf("list transactions by household: %w", err)
	}
	out := make([]*PurchaseTransaction, len(rows))
	for i, row := range rows {
		out[i] = toTransaction(row)
	}
	return out, nil
}

func (r *pgRepository) ListTransactionsByCatalogEntry(ctx context.Context, catalogEntryID uuid.UUID) ([]*PurchaseTransaction, error) {
	rows, err := r.q.ListPurchaseTransactionsByCatalogEntry(ctx, uuidToPg(catalogEntryID))
	if err != nil {
		return nil, fmt.Errorf("list transactions by catalog entry: %w", err)
	}
	out := make([]*PurchaseTransaction, len(rows))
	for i, row := range rows {
		out[i] = toTransaction(row)
	}
	return out, nil
}
