package grocery

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

// --- lists ---

func (r *pgRepository) toList(row sqlc.GroceryList) *GroceryList {
	return &GroceryList{
		ID:              shared.PgToUUID(row.ID),
		InventoryID:     shared.PgToUUID(row.InventoryID),
		Name:            row.Name,
		Status:          row.Status,
		CreatedByUserID: shared.PgToUUID(row.CreatedByUserID),
		CompletedAt:     shared.PgToTimePtr(row.CompletedAt),
		PinnedAt:        shared.PgToTimePtr(row.PinnedAt),
		ExpiresAt:       shared.PgToTimePtr(row.ExpiresAt),
		CreatedAt:       row.CreatedAt.Time,
		UpdatedAt:       row.UpdatedAt.Time,
	}
}

func (r *pgRepository) CreateList(ctx context.Context, inventoryID uuid.UUID, name string, createdBy uuid.UUID) (*GroceryList, error) {
	row, err := r.q.CreateGroceryList(ctx, sqlc.CreateGroceryListParams{
		InventoryID:     shared.UUIDToPg(inventoryID),
		Name:            name,
		CreatedByUserID: shared.UUIDToPg(createdBy),
	})
	if err != nil {
		return nil, fmt.Errorf("create list: %w", err)
	}
	return r.toList(row), nil
}

func (r *pgRepository) GetList(ctx context.Context, id uuid.UUID) (*GroceryList, error) {
	row, err := r.q.GetGroceryListByID(ctx, shared.UUIDToPg(id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get list: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get list: %w", err)
	}
	return r.toList(row), nil
}

func (r *pgRepository) ListByInventory(ctx context.Context, inventoryID uuid.UUID) ([]*GroceryList, error) {
	rows, err := r.q.ListGroceryListsByInventory(ctx, shared.UUIDToPg(inventoryID))
	if err != nil {
		return nil, fmt.Errorf("list by inventory: %w", err)
	}
	out := make([]*GroceryList, len(rows))
	for i, row := range rows {
		out[i] = r.toList(row)
	}
	return out, nil
}

func (r *pgRepository) UpdateListStatus(ctx context.Context, id uuid.UUID, status string, completedAt *time.Time) (*GroceryList, error) {
	row, err := r.q.UpdateGroceryListStatus(ctx, sqlc.UpdateGroceryListStatusParams{
		ID:          shared.UUIDToPg(id),
		Status:      status,
		CompletedAt: shared.TimePtrToPg(completedAt),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("update list status: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("update list status: %w", err)
	}
	return r.toList(row), nil
}

func (r *pgRepository) ArchiveList(ctx context.Context, id uuid.UUID) error {
	if err := r.q.ArchiveGroceryList(ctx, shared.UUIDToPg(id)); err != nil {
		return fmt.Errorf("archive list: %w", err)
	}
	return nil
}

func (r *pgRepository) RenameList(ctx context.Context, id uuid.UUID, name string) (*GroceryList, error) {
	row, err := r.q.RenameGroceryList(ctx, sqlc.RenameGroceryListParams{
		ID:   shared.UUIDToPg(id),
		Name: name,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("rename list: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("rename list: %w", err)
	}
	return r.toList(row), nil
}

func (r *pgRepository) DeleteList(ctx context.Context, id uuid.UUID) error {
	if err := r.q.DeleteGroceryList(ctx, shared.UUIDToPg(id)); err != nil {
		return fmt.Errorf("delete list: %w", err)
	}
	return nil
}

// --- items ---

func (r *pgRepository) toItem(row sqlc.GroceryListItem) *GroceryListItem {
	return &GroceryListItem{
		ID:              shared.PgToUUID(row.ID),
		GroceryListID:   shared.PgToUUID(row.GroceryListID),
		InventoryItemID: shared.PgToUUIDPtr(row.InventoryItemID),
		Name:            row.Name,
		Quantity:        shared.PgNumericToFloat(row.Quantity),
		Unit:            shared.PtrStr(row.Unit),
		Notes:           row.Notes,
		Status:          row.Status,
		SortOrder:       int(row.SortOrder),
		CreatedAt:       row.CreatedAt.Time,
		UpdatedAt:       row.UpdatedAt.Time,
	}
}

func (r *pgRepository) AddItem(ctx context.Context, listID uuid.UUID, inventoryItemID *uuid.UUID, name string, quantity float64, unit string, notes *string, sortOrder int) (*GroceryListItem, error) {
	row, err := r.q.AddGroceryListItem(ctx, sqlc.AddGroceryListItemParams{
		GroceryListID:   shared.UUIDToPg(listID),
		InventoryItemID: shared.UUIDPtrToPg(inventoryItemID),
		Name:            name,
		Quantity:        shared.FloatToPgNumeric(quantity),
		Unit:            shared.StrToPtr(unit),
		Notes:           notes,
		SortOrder:       int32(sortOrder),
	})
	if err != nil {
		return nil, fmt.Errorf("add item: %w", err)
	}
	return r.toItem(row), nil
}

func (r *pgRepository) GetItem(ctx context.Context, id uuid.UUID) (*GroceryListItem, error) {
	row, err := r.q.GetGroceryListItemByID(ctx, shared.UUIDToPg(id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get item: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get item: %w", err)
	}
	return r.toItem(row), nil
}

func (r *pgRepository) ListItems(ctx context.Context, listID uuid.UUID) ([]*GroceryListItem, error) {
	rows, err := r.q.ListGroceryListItems(ctx, shared.UUIDToPg(listID))
	if err != nil {
		return nil, fmt.Errorf("list items: %w", err)
	}
	out := make([]*GroceryListItem, len(rows))
	for i, row := range rows {
		out[i] = r.toItem(row)
	}
	return out, nil
}

func (r *pgRepository) UpdateItemStatus(ctx context.Context, id uuid.UUID, status string) (*GroceryListItem, error) {
	row, err := r.q.UpdateGroceryListItemStatus(ctx, sqlc.UpdateGroceryListItemStatusParams{
		ID:     shared.UUIDToPg(id),
		Status: status,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("update item status: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("update item status: %w", err)
	}
	return r.toItem(row), nil
}

func (r *pgRepository) ReorderItem(ctx context.Context, id uuid.UUID, sortOrder int) error {
	if err := r.q.UpdateGroceryListItemSortOrder(ctx, sqlc.UpdateGroceryListItemSortOrderParams{
		ID:        shared.UUIDToPg(id),
		SortOrder: int32(sortOrder),
	}); err != nil {
		return fmt.Errorf("reorder item: %w", err)
	}
	return nil
}

func (r *pgRepository) DeleteItem(ctx context.Context, id uuid.UUID) error {
	if err := r.q.DeleteGroceryListItem(ctx, shared.UUIDToPg(id)); err != nil {
		return fmt.Errorf("delete item: %w", err)
	}
	return nil
}
