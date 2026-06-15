package inventory

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/willian-m/baskety/gen/sqlc"
	"github.com/willian-m/baskety/internal/shared"
)

var ErrNotFound = errors.New("not found")

type pgRepository struct {
	q *sqlc.Queries
}

func NewPgRepository(pool *pgxpool.Pool) Repository {
	return &pgRepository{q: sqlc.New(pool)}
}

// --- inventories ---

func (r *pgRepository) toInventory(row sqlc.Inventory) *Inventory {
	return &Inventory{
		ID:          shared.PgToUUID(row.ID),
		HouseholdID: shared.PgToUUID(row.HouseholdID),
		Name:        row.Name,
		Description: row.Description,
		CreatedAt:   row.CreatedAt.Time,
		UpdatedAt:   row.UpdatedAt.Time,
	}
}

func (r *pgRepository) CreateInventory(ctx context.Context, householdID uuid.UUID, name string, description *string) (*Inventory, error) {
	row, err := r.q.CreateInventory(ctx, sqlc.CreateInventoryParams{
		HouseholdID: shared.UUIDToPg(householdID),
		Name:        name,
		Description: description,
	})
	if err != nil {
		return nil, fmt.Errorf("create inventory: %w", err)
	}
	return r.toInventory(row), nil
}

func (r *pgRepository) GetInventory(ctx context.Context, id uuid.UUID) (*Inventory, error) {
	row, err := r.q.GetInventoryByID(ctx, shared.UUIDToPg(id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get inventory: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get inventory: %w", err)
	}
	return r.toInventory(row), nil
}

func (r *pgRepository) ListInventories(ctx context.Context, householdID uuid.UUID) ([]*Inventory, error) {
	rows, err := r.q.ListInventoriesByHousehold(ctx, shared.UUIDToPg(householdID))
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
		ID:          shared.UUIDToPg(id),
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
	if err := r.q.DeleteInventory(ctx, shared.UUIDToPg(id)); err != nil {
		return fmt.Errorf("delete inventory: %w", err)
	}
	return nil
}

// --- items ---

func (r *pgRepository) toItem(row sqlc.InventoryItem) *InventoryItem {
	return &InventoryItem{
		ID:             shared.PgToUUID(row.ID),
		InventoryID:    shared.PgToUUID(row.InventoryID),
		Name:           row.Name,
		Category:       shared.PtrStr(row.Category),
		Unit:           shared.PtrStr(row.Unit),
		TargetQuantity: shared.PgNumericToFloat(row.TargetQuantity),
		Notes:          row.Notes,
		DeletedAt:      shared.PgToTimePtr(row.DeletedAt),
		CreatedAt:      row.CreatedAt.Time,
		UpdatedAt:      row.UpdatedAt.Time,
	}
}

func (r *pgRepository) CreateItem(ctx context.Context, inventoryID uuid.UUID, name, category, unit string, targetQuantity float64, notes *string) (*InventoryItem, error) {
	row, err := r.q.CreateInventoryItem(ctx, sqlc.CreateInventoryItemParams{
		InventoryID:    shared.UUIDToPg(inventoryID),
		Name:           name,
		Category:       shared.StrToPtr(category),
		Unit:           shared.StrToPtr(unit),
		TargetQuantity: shared.FloatToPgNumeric(targetQuantity),
		Notes:          notes,
	})
	if err != nil {
		return nil, fmt.Errorf("create item: %w", err)
	}
	return r.toItem(row), nil
}

func (r *pgRepository) GetItem(ctx context.Context, id uuid.UUID) (*InventoryItem, error) {
	row, err := r.q.GetInventoryItemByID(ctx, shared.UUIDToPg(id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get item: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get item: %w", err)
	}
	return r.toItem(row), nil
}

func (r *pgRepository) toItemFromListRow(row sqlc.ListInventoryItemsRow) *InventoryItem {
	return &InventoryItem{
		ID:             shared.PgToUUID(row.ID),
		InventoryID:    shared.PgToUUID(row.InventoryID),
		Name:           row.Name,
		Category:       shared.PtrStr(row.Category),
		Unit:           shared.PtrStr(row.Unit),
		TargetQuantity: shared.PgNumericToFloat(row.TargetQuantity),
		Notes:          row.Notes,
		DeletedAt:      shared.PgToTimePtr(row.DeletedAt),
		CreatedAt:      row.CreatedAt.Time,
		UpdatedAt:      row.UpdatedAt.Time,
		StoredQuantity: shared.PgNumericToFloat(row.StoredQuantity),
		BatchCount:     row.BatchCount,
	}
}

func (r *pgRepository) ListItems(ctx context.Context, inventoryID uuid.UUID) ([]*InventoryItem, error) {
	rows, err := r.q.ListInventoryItems(ctx, shared.UUIDToPg(inventoryID))
	if err != nil {
		return nil, fmt.Errorf("list items: %w", err)
	}
	out := make([]*InventoryItem, len(rows))
	for i, row := range rows {
		out[i] = r.toItemFromListRow(row)
	}
	return out, nil
}

func (r *pgRepository) UpdateItem(ctx context.Context, id uuid.UUID, name, category, unit string, targetQuantity float64, notes *string) (*InventoryItem, error) {
	row, err := r.q.UpdateInventoryItem(ctx, sqlc.UpdateInventoryItemParams{
		ID:             shared.UUIDToPg(id),
		Name:           name,
		Category:       shared.StrToPtr(category),
		Unit:           shared.StrToPtr(unit),
		TargetQuantity: shared.FloatToPgNumeric(targetQuantity),
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
	if err := r.q.SoftDeleteInventoryItem(ctx, shared.UUIDToPg(id)); err != nil {
		return fmt.Errorf("soft delete item: %w", err)
	}
	return nil
}

func (r *pgRepository) GetItemQuantity(ctx context.Context, itemID uuid.UUID) (float64, error) {
	n, err := r.q.GetInventoryItemQuantity(ctx, shared.UUIDToPg(itemID))
	if err != nil {
		return 0, fmt.Errorf("get item quantity: %w", err)
	}
	return shared.PgNumericToFloat(n), nil
}

// --- batches ---

func (r *pgRepository) toBatch(row sqlc.InventoryBatch) *InventoryBatch {
	return &InventoryBatch{
		ID:        shared.PgToUUID(row.ID),
		ItemID:    shared.PgToUUID(row.ItemID),
		Quantity:  shared.PgNumericToFloat(row.Quantity),
		ExpiresAt: shared.PgToTimePtr(row.ExpiresAt),
		AddedAt:   row.AddedAt.Time,
		EmptiedAt: shared.PgToTimePtr(row.EmptiedAt),
		Notes:     row.Notes,
		CreatedAt: row.CreatedAt.Time,
	}
}

func (r *pgRepository) AddBatch(ctx context.Context, itemID uuid.UUID, quantity float64, expiresAt *time.Time, notes *string) (*InventoryBatch, error) {
	row, err := r.q.CreateInventoryBatch(ctx, sqlc.CreateInventoryBatchParams{
		ItemID:    shared.UUIDToPg(itemID),
		Quantity:  shared.FloatToPgNumeric(quantity),
		ExpiresAt: shared.TimePtrToPg(expiresAt),
		Notes:     notes,
	})
	if err != nil {
		return nil, fmt.Errorf("add batch: %w", err)
	}
	return r.toBatch(row), nil
}

func (r *pgRepository) GetBatch(ctx context.Context, id uuid.UUID) (*InventoryBatch, error) {
	row, err := r.q.GetInventoryBatchByID(ctx, shared.UUIDToPg(id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get batch: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get batch: %w", err)
	}
	return r.toBatch(row), nil
}

func (r *pgRepository) ListActiveBatches(ctx context.Context, itemID uuid.UUID) ([]*InventoryBatch, error) {
	rows, err := r.q.ListActiveBatchesByItem(ctx, shared.UUIDToPg(itemID))
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
	if err := r.q.MarkBatchEmptied(ctx, shared.UUIDToPg(id)); err != nil {
		return fmt.Errorf("mark batch emptied: %w", err)
	}
	return nil
}

func (r *pgRepository) PatchBatch(ctx context.Context, id uuid.UUID, quantity float64, expiresAt *time.Time, notes *string) (*InventoryBatch, error) {
	row, err := r.q.PatchBatch(ctx, sqlc.PatchBatchParams{
		ID:        shared.UUIDToPg(id),
		Quantity:  shared.FloatToPgNumeric(quantity),
		ExpiresAt: shared.TimePtrToPg(expiresAt),
		Notes:     notes,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("patch batch: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("patch batch: %w", err)
	}
	return r.toBatch(row), nil
}
