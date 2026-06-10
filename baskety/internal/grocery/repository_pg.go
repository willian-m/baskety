package grocery

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

func uuidPtrToPg(id *uuid.UUID) pgtype.UUID {
	if id == nil {
		return pgtype.UUID{Valid: false}
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
	_ = n.Scan(fmt.Sprintf("%v", f))
	return n
}

func pgNumericToFloat(n pgtype.Numeric) float64 {
	if !n.Valid || n.NaN {
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

func strFromPtr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func ptrStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// --- lists ---

func (r *pgRepository) toList(row sqlc.GroceryList) *GroceryList {
	return &GroceryList{
		ID:              pgToUUID(row.ID),
		InventoryID:     pgToUUID(row.InventoryID),
		Name:            row.Name,
		Status:          row.Status,
		CreatedByUserID: pgToUUID(row.CreatedByUserID),
		CompletedAt:     pgToTimePtr(row.CompletedAt),
		PinnedAt:        pgToTimePtr(row.PinnedAt),
		ExpiresAt:       pgToTimePtr(row.ExpiresAt),
		CreatedAt:       row.CreatedAt.Time,
		UpdatedAt:       row.UpdatedAt.Time,
	}
}

func (r *pgRepository) CreateList(ctx context.Context, inventoryID uuid.UUID, name string, createdBy uuid.UUID) (*GroceryList, error) {
	row, err := r.q.CreateGroceryList(ctx, sqlc.CreateGroceryListParams{
		InventoryID:     uuidToPg(inventoryID),
		Name:            name,
		CreatedByUserID: uuidToPg(createdBy),
	})
	if err != nil {
		return nil, fmt.Errorf("create list: %w", err)
	}
	return r.toList(row), nil
}

func (r *pgRepository) GetList(ctx context.Context, id uuid.UUID) (*GroceryList, error) {
	row, err := r.q.GetGroceryListByID(ctx, uuidToPg(id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get list: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get list: %w", err)
	}
	return r.toList(row), nil
}

func (r *pgRepository) ListByInventory(ctx context.Context, inventoryID uuid.UUID) ([]*GroceryList, error) {
	rows, err := r.q.ListGroceryListsByInventory(ctx, uuidToPg(inventoryID))
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
		ID:          uuidToPg(id),
		Status:      status,
		CompletedAt: timeToPg(completedAt),
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
	if err := r.q.ArchiveGroceryList(ctx, uuidToPg(id)); err != nil {
		return fmt.Errorf("archive list: %w", err)
	}
	return nil
}

// --- items ---

func (r *pgRepository) toItem(row sqlc.GroceryListItem) *GroceryListItem {
	return &GroceryListItem{
		ID:              pgToUUID(row.ID),
		GroceryListID:   pgToUUID(row.GroceryListID),
		InventoryItemID: pgToUUIDPtr(row.InventoryItemID),
		Name:            row.Name,
		Quantity:        pgNumericToFloat(row.Quantity),
		Unit:            strFromPtr(row.Unit),
		Notes:           row.Notes,
		Status:          row.Status,
		SortOrder:       int(row.SortOrder),
		CreatedAt:       row.CreatedAt.Time,
		UpdatedAt:       row.UpdatedAt.Time,
	}
}

func (r *pgRepository) AddItem(ctx context.Context, listID uuid.UUID, inventoryItemID *uuid.UUID, name string, quantity float64, unit string, notes *string, sortOrder int) (*GroceryListItem, error) {
	row, err := r.q.AddGroceryListItem(ctx, sqlc.AddGroceryListItemParams{
		GroceryListID:   uuidToPg(listID),
		InventoryItemID: uuidPtrToPg(inventoryItemID),
		Name:            name,
		Quantity:        floatToPgNumeric(quantity),
		Unit:            ptrStr(unit),
		Notes:           notes,
		SortOrder:       int32(sortOrder),
	})
	if err != nil {
		return nil, fmt.Errorf("add item: %w", err)
	}
	return r.toItem(row), nil
}

func (r *pgRepository) GetItem(ctx context.Context, id uuid.UUID) (*GroceryListItem, error) {
	row, err := r.q.GetGroceryListItemByID(ctx, uuidToPg(id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("get item: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get item: %w", err)
	}
	return r.toItem(row), nil
}

func (r *pgRepository) ListItems(ctx context.Context, listID uuid.UUID) ([]*GroceryListItem, error) {
	rows, err := r.q.ListGroceryListItems(ctx, uuidToPg(listID))
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
		ID:     uuidToPg(id),
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
		ID:        uuidToPg(id),
		SortOrder: int32(sortOrder),
	}); err != nil {
		return fmt.Errorf("reorder item: %w", err)
	}
	return nil
}

func (r *pgRepository) DeleteItem(ctx context.Context, id uuid.UUID) error {
	if err := r.q.DeleteGroceryListItem(ctx, uuidToPg(id)); err != nil {
		return fmt.Errorf("delete item: %w", err)
	}
	return nil
}
