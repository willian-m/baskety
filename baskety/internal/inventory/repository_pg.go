package inventory

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
	q *sqlc.Queries
}

func NewPgRepository(pool *pgxpool.Pool) Repository {
	return &pgRepository{q: sqlc.New(pool)}
}

func uuidToPg(id uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: id, Valid: true}
}

func pgToUUID(id pgtype.UUID) uuid.UUID {
	return uuid.UUID(id.Bytes)
}

func timeToPg(t *time.Time) pgtype.Timestamptz {
	if t == nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: *t, Valid: true}
}

func pgToTimePtr(t pgtype.Timestamptz) *time.Time {
	if !t.Valid {
		return nil
	}
	return &t.Time
}

func floatToPgNumeric(f float64) pgtype.Numeric {
	var n pgtype.Numeric
	// Scan from the decimal string representation to preserve precision.
	_ = n.Scan(fmt.Sprintf("%v", f))
	return n
}

func pgNumericToFloat(n pgtype.Numeric) float64 {
	if !n.Valid {
		return 0
	}
	if n.NaN {
		return 0
	}
	f := new(big.Float).SetInt(n.Int)
	if n.Exp != 0 {
		exp := new(big.Float).SetFloat64(pow10(n.Exp))
		f.Mul(f, exp)
	}
	res, _ := f.Float64()
	return res
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

func ptrStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func strFromPtr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// --- inventories ---

func (r *pgRepository) toInventory(row sqlc.Inventory) *Inventory {
	return &Inventory{
		ID:          pgToUUID(row.ID),
		HouseholdID: pgToUUID(row.HouseholdID),
		Name:        row.Name,
		Description: row.Description,
		CreatedAt:   row.CreatedAt.Time,
		UpdatedAt:   row.UpdatedAt.Time,
	}
}

func (r *pgRepository) CreateInventory(ctx context.Context, householdID uuid.UUID, name string, description *string) (*Inventory, error) {
	row, err := r.q.CreateInventory(ctx, sqlc.CreateInventoryParams{
		HouseholdID: uuidToPg(householdID),
		Name:        name,
		Description: description,
	})
	if err != nil {
		return nil, fmt.Errorf("create inventory: %w", err)
	}
	return r.toInventory(row), nil
}

func (r *pgRepository) GetInventory(ctx context.Context, id uuid.UUID) (*Inventory, error) {
	row, err := r.q.GetInventoryByID(ctx, uuidToPg(id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get inventory: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get inventory: %w", err)
	}
	return r.toInventory(row), nil
}

func (r *pgRepository) ListInventories(ctx context.Context, householdID uuid.UUID) ([]*Inventory, error) {
	rows, err := r.q.ListInventoriesByHousehold(ctx, uuidToPg(householdID))
	if err != nil {
		return nil, fmt.Errorf("list inventories: %w", err)
	}
	out := make([]*Inventory, len(rows))
	for i, row := range rows {
		out[i] = r.toInventory(row)
	}
	return out, nil
}

func (r *pgRepository) UpdateInventory(ctx context.Context, id uuid.UUID, name string, description *string) (*Inventory, error) {
	row, err := r.q.UpdateInventory(ctx, sqlc.UpdateInventoryParams{
		ID:          uuidToPg(id),
		Name:        name,
		Description: description,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("update inventory: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("update inventory: %w", err)
	}
	return r.toInventory(row), nil
}

func (r *pgRepository) DeleteInventory(ctx context.Context, id uuid.UUID) error {
	if err := r.q.DeleteInventory(ctx, uuidToPg(id)); err != nil {
		return fmt.Errorf("delete inventory: %w", err)
	}
	return nil
}

// --- items ---

func (r *pgRepository) toItem(row sqlc.InventoryItem) *InventoryItem {
	return &InventoryItem{
		ID:             pgToUUID(row.ID),
		InventoryID:    pgToUUID(row.InventoryID),
		Name:           row.Name,
		Category:       strFromPtr(row.Category),
		Unit:           strFromPtr(row.Unit),
		TargetQuantity: pgNumericToFloat(row.TargetQuantity),
		Notes:          row.Notes,
		DeletedAt:      pgToTimePtr(row.DeletedAt),
		CreatedAt:      row.CreatedAt.Time,
		UpdatedAt:      row.UpdatedAt.Time,
	}
}

func (r *pgRepository) CreateItem(ctx context.Context, inventoryID uuid.UUID, name, category, unit string, targetQuantity float64, notes *string) (*InventoryItem, error) {
	row, err := r.q.CreateInventoryItem(ctx, sqlc.CreateInventoryItemParams{
		InventoryID:    uuidToPg(inventoryID),
		Name:           name,
		Category:       ptrStr(category),
		Unit:           ptrStr(unit),
		TargetQuantity: floatToPgNumeric(targetQuantity),
		Notes:          notes,
	})
	if err != nil {
		return nil, fmt.Errorf("create item: %w", err)
	}
	return r.toItem(row), nil
}

func (r *pgRepository) GetItem(ctx context.Context, id uuid.UUID) (*InventoryItem, error) {
	row, err := r.q.GetInventoryItemByID(ctx, uuidToPg(id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get item: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get item: %w", err)
	}
	return r.toItem(row), nil
}

func (r *pgRepository) ListItems(ctx context.Context, inventoryID uuid.UUID) ([]*InventoryItem, error) {
	rows, err := r.q.ListInventoryItems(ctx, uuidToPg(inventoryID))
	if err != nil {
		return nil, fmt.Errorf("list items: %w", err)
	}
	out := make([]*InventoryItem, len(rows))
	for i, row := range rows {
		out[i] = r.toItem(row)
	}
	return out, nil
}

func (r *pgRepository) UpdateItem(ctx context.Context, id uuid.UUID, name, category, unit string, targetQuantity float64, notes *string) (*InventoryItem, error) {
	row, err := r.q.UpdateInventoryItem(ctx, sqlc.UpdateInventoryItemParams{
		ID:             uuidToPg(id),
		Name:           name,
		Category:       ptrStr(category),
		Unit:           ptrStr(unit),
		TargetQuantity: floatToPgNumeric(targetQuantity),
		Notes:          notes,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("update item: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("update item: %w", err)
	}
	return r.toItem(row), nil
}

func (r *pgRepository) SoftDeleteItem(ctx context.Context, id uuid.UUID) error {
	if err := r.q.SoftDeleteInventoryItem(ctx, uuidToPg(id)); err != nil {
		return fmt.Errorf("soft delete item: %w", err)
	}
	return nil
}

func (r *pgRepository) GetItemQuantity(ctx context.Context, itemID uuid.UUID) (float64, error) {
	n, err := r.q.GetInventoryItemQuantity(ctx, uuidToPg(itemID))
	if err != nil {
		return 0, fmt.Errorf("get item quantity: %w", err)
	}
	return pgNumericToFloat(n), nil
}

// --- batches ---

func (r *pgRepository) toBatch(row sqlc.InventoryBatch) *InventoryBatch {
	return &InventoryBatch{
		ID:        pgToUUID(row.ID),
		ItemID:    pgToUUID(row.ItemID),
		Quantity:  pgNumericToFloat(row.Quantity),
		ExpiresAt: pgToTimePtr(row.ExpiresAt),
		AddedAt:   row.AddedAt.Time,
		EmptiedAt: pgToTimePtr(row.EmptiedAt),
		Notes:     row.Notes,
		CreatedAt: row.CreatedAt.Time,
	}
}

func (r *pgRepository) AddBatch(ctx context.Context, itemID uuid.UUID, quantity float64, expiresAt *time.Time, notes *string) (*InventoryBatch, error) {
	row, err := r.q.CreateInventoryBatch(ctx, sqlc.CreateInventoryBatchParams{
		ItemID:    uuidToPg(itemID),
		Quantity:  floatToPgNumeric(quantity),
		ExpiresAt: timeToPg(expiresAt),
		Notes:     notes,
	})
	if err != nil {
		return nil, fmt.Errorf("add batch: %w", err)
	}
	return r.toBatch(row), nil
}

func (r *pgRepository) GetBatch(ctx context.Context, id uuid.UUID) (*InventoryBatch, error) {
	row, err := r.q.GetInventoryBatchByID(ctx, uuidToPg(id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get batch: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get batch: %w", err)
	}
	return r.toBatch(row), nil
}

func (r *pgRepository) ListActiveBatches(ctx context.Context, itemID uuid.UUID) ([]*InventoryBatch, error) {
	rows, err := r.q.ListActiveBatchesByItem(ctx, uuidToPg(itemID))
	if err != nil {
		return nil, fmt.Errorf("list active batches: %w", err)
	}
	out := make([]*InventoryBatch, len(rows))
	for i, row := range rows {
		out[i] = r.toBatch(row)
	}
	return out, nil
}

func (r *pgRepository) MarkBatchEmptied(ctx context.Context, id uuid.UUID) error {
	if err := r.q.MarkBatchEmptied(ctx, uuidToPg(id)); err != nil {
		return fmt.Errorf("mark batch emptied: %w", err)
	}
	return nil
}
