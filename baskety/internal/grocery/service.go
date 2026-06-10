package grocery

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/willian-m/baskety/internal/inventory"
)

var (
	ErrForbidden    = errors.New("forbidden")
	ErrInvalidInput = errors.New("invalid input")
)

const defaultExpiryThresholdDays = 7

var validListStatus = map[string]bool{
	"active": true, "completed": true, "archived": true,
}

var validItemStatus = map[string]bool{
	"pending": true, "bought": true, "skipped": true,
}

// ServiceIface allows handler testing with mocks.
type ServiceIface interface {
	// list management
	CreateList(ctx context.Context, inventoryID, householdID, userID uuid.UUID, req CreateListRequest) (*ListResponse, error)
	GetList(ctx context.Context, id, householdID uuid.UUID) (*ListResponse, error)
	ListByInventory(ctx context.Context, inventoryID, householdID uuid.UUID) ([]*ListResponse, error)
	CompleteList(ctx context.Context, id, householdID uuid.UUID) (*ListResponse, error)
	ArchiveList(ctx context.Context, id, householdID uuid.UUID) error

	// item management
	AddItem(ctx context.Context, listID, householdID uuid.UUID, req AddItemRequest) (*ItemResponse, error)
	GetItem(ctx context.Context, itemID, listID, householdID uuid.UUID) (*ItemResponse, error)
	ListItems(ctx context.Context, listID, householdID uuid.UUID) ([]*ItemResponse, error)
	UpdateItemStatus(ctx context.Context, itemID, listID, householdID uuid.UUID, req UpdateItemStatusRequest) (*ItemResponse, error)
	ReorderItem(ctx context.Context, itemID, listID, householdID uuid.UUID, req ReorderItemRequest) error
	DeleteItem(ctx context.Context, itemID, listID, householdID uuid.UUID) error

	// auto-generation
	AutoGenerate(ctx context.Context, inventoryID, householdID, userID uuid.UUID, req AutoGenerateRequest) (*ListResponse, error)
}

type Service struct {
	repo      Repository
	inventory inventory.ServiceIface
}

func NewService(repo Repository, inv inventory.ServiceIface) *Service {
	return &Service{repo: repo, inventory: inv}
}

var _ ServiceIface = (*Service)(nil)

// mapInventoryErr translates inventory sentinel errors to grocery sentinels so
// handlers can map them uniformly.
func mapInventoryErr(err error) error {
	if errors.Is(err, inventory.ErrNotFound) {
		return fmt.Errorf("inventory scope: %w", ErrNotFound)
	}
	if errors.Is(err, inventory.ErrForbidden) {
		return fmt.Errorf("inventory scope: %w", ErrForbidden)
	}
	return err
}

// assertInventoryScope verifies the inventory belongs to the household.
func (s *Service) assertInventoryScope(ctx context.Context, inventoryID, householdID uuid.UUID) error {
	if _, err := s.inventory.GetInventory(ctx, inventoryID, householdID); err != nil {
		return mapInventoryErr(err)
	}
	return nil
}

// assertListScope fetches a list and verifies its inventory belongs to the household.
func (s *Service) assertListScope(ctx context.Context, listID, householdID uuid.UUID) (*GroceryList, error) {
	list, err := s.repo.GetList(ctx, listID)
	if err != nil {
		return nil, err
	}
	if err := s.assertInventoryScope(ctx, list.InventoryID, householdID); err != nil {
		return nil, err
	}
	return list, nil
}

// assertItemScope fetches an item, verifies it belongs to listID, then verifies
// the list's inventory belongs to the household.
func (s *Service) assertItemScope(ctx context.Context, itemID, listID, householdID uuid.UUID) (*GroceryListItem, error) {
	item, err := s.repo.GetItem(ctx, itemID)
	if err != nil {
		return nil, err
	}
	if item.GroceryListID != listID {
		return nil, fmt.Errorf("item not in list: %w", ErrNotFound)
	}
	if _, err := s.assertListScope(ctx, listID, householdID); err != nil {
		return nil, err
	}
	return item, nil
}

// --- list management ---

func (s *Service) CreateList(ctx context.Context, inventoryID, householdID, userID uuid.UUID, req CreateListRequest) (*ListResponse, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("name required: %w", ErrInvalidInput)
	}
	if err := s.assertInventoryScope(ctx, inventoryID, householdID); err != nil {
		return nil, err
	}
	list, err := s.repo.CreateList(ctx, inventoryID, req.Name, userID)
	if err != nil {
		return nil, fmt.Errorf("creating list: %w", err)
	}
	return toListResponse(list), nil
}

func (s *Service) GetList(ctx context.Context, id, householdID uuid.UUID) (*ListResponse, error) {
	list, err := s.assertListScope(ctx, id, householdID)
	if err != nil {
		return nil, err
	}
	return toListResponse(list), nil
}

func (s *Service) ListByInventory(ctx context.Context, inventoryID, householdID uuid.UUID) ([]*ListResponse, error) {
	if err := s.assertInventoryScope(ctx, inventoryID, householdID); err != nil {
		return nil, err
	}
	lists, err := s.repo.ListByInventory(ctx, inventoryID)
	if err != nil {
		return nil, fmt.Errorf("listing lists: %w", err)
	}
	out := make([]*ListResponse, len(lists))
	for i, l := range lists {
		out[i] = toListResponse(l)
	}
	return out, nil
}

func (s *Service) CompleteList(ctx context.Context, id, householdID uuid.UUID) (*ListResponse, error) {
	if _, err := s.assertListScope(ctx, id, householdID); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	list, err := s.repo.UpdateListStatus(ctx, id, "completed", &now)
	if err != nil {
		return nil, fmt.Errorf("completing list: %w", err)
	}
	return toListResponse(list), nil
}

func (s *Service) ArchiveList(ctx context.Context, id, householdID uuid.UUID) error {
	if _, err := s.assertListScope(ctx, id, householdID); err != nil {
		return err
	}
	return s.repo.ArchiveList(ctx, id)
}

// --- item management ---

func (s *Service) AddItem(ctx context.Context, listID, householdID uuid.UUID, req AddItemRequest) (*ItemResponse, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("name required: %w", ErrInvalidInput)
	}
	if _, err := s.assertListScope(ctx, listID, householdID); err != nil {
		return nil, err
	}
	var invItemID *uuid.UUID
	if req.InventoryItemID != nil && *req.InventoryItemID != "" {
		parsed, err := uuid.Parse(*req.InventoryItemID)
		if err != nil {
			return nil, fmt.Errorf("invalid inventory_item_id: %w", ErrInvalidInput)
		}
		invItemID = &parsed
	}
	quantity := req.Quantity
	if quantity <= 0 {
		quantity = 1
	}
	item, err := s.repo.AddItem(ctx, listID, invItemID, req.Name, quantity, req.Unit, req.Notes, req.SortOrder)
	if err != nil {
		return nil, fmt.Errorf("adding item: %w", err)
	}
	return toItemResponse(item), nil
}

func (s *Service) GetItem(ctx context.Context, itemID, listID, householdID uuid.UUID) (*ItemResponse, error) {
	item, err := s.assertItemScope(ctx, itemID, listID, householdID)
	if err != nil {
		return nil, err
	}
	return toItemResponse(item), nil
}

func (s *Service) ListItems(ctx context.Context, listID, householdID uuid.UUID) ([]*ItemResponse, error) {
	if _, err := s.assertListScope(ctx, listID, householdID); err != nil {
		return nil, err
	}
	items, err := s.repo.ListItems(ctx, listID)
	if err != nil {
		return nil, fmt.Errorf("listing items: %w", err)
	}
	out := make([]*ItemResponse, len(items))
	for i, it := range items {
		out[i] = toItemResponse(it)
	}
	return out, nil
}

func (s *Service) UpdateItemStatus(ctx context.Context, itemID, listID, householdID uuid.UUID, req UpdateItemStatusRequest) (*ItemResponse, error) {
	if !validItemStatus[req.Status] {
		return nil, fmt.Errorf("invalid status: %w", ErrInvalidInput)
	}
	if _, err := s.assertItemScope(ctx, itemID, listID, householdID); err != nil {
		return nil, err
	}
	item, err := s.repo.UpdateItemStatus(ctx, itemID, req.Status)
	if err != nil {
		return nil, fmt.Errorf("updating item status: %w", err)
	}
	return toItemResponse(item), nil
}

func (s *Service) ReorderItem(ctx context.Context, itemID, listID, householdID uuid.UUID, req ReorderItemRequest) error {
	if _, err := s.assertItemScope(ctx, itemID, listID, householdID); err != nil {
		return err
	}
	return s.repo.ReorderItem(ctx, itemID, req.SortOrder)
}

func (s *Service) DeleteItem(ctx context.Context, itemID, listID, householdID uuid.UUID) error {
	if _, err := s.assertItemScope(ctx, itemID, listID, householdID); err != nil {
		return err
	}
	return s.repo.DeleteItem(ctx, itemID)
}

// --- auto-generation ---

func (s *Service) AutoGenerate(ctx context.Context, inventoryID, householdID, userID uuid.UUID, req AutoGenerateRequest) (*ListResponse, error) {
	if err := s.assertInventoryScope(ctx, inventoryID, householdID); err != nil {
		return nil, err
	}

	threshold := req.ExpiryThresholdDays
	if threshold <= 0 {
		threshold = defaultExpiryThresholdDays
	}
	_ = threshold // TODO(sprint6): expiry-based shortfalls require batch listing on
	// inventory.ServiceIface; v1 only handles quantity shortfalls.

	items, err := s.inventory.ListItems(ctx, inventoryID, householdID)
	if err != nil {
		return nil, mapInventoryErr(err)
	}

	name := fmt.Sprintf("Auto-generated %s", time.Now().UTC().Format("2006-01-02"))
	list, err := s.repo.CreateList(ctx, inventoryID, name, userID)
	if err != nil {
		return nil, fmt.Errorf("creating auto list: %w", err)
	}

	sortOrder := 0
	for _, it := range items {
		itemID, perr := uuid.Parse(it.ID)
		if perr != nil {
			continue
		}
		effective, err := s.inventory.GetEffectiveQuantity(ctx, itemID, householdID)
		if err != nil {
			return nil, mapInventoryErr(err)
		}
		if effective >= it.TargetQuantity {
			continue
		}
		shortfall := round3(it.TargetQuantity - effective)
		invItemID := itemID
		if _, err := s.repo.AddItem(ctx, list.ID, &invItemID, it.Name, shortfall, it.Unit, nil, sortOrder); err != nil {
			return nil, fmt.Errorf("adding auto item: %w", err)
		}
		sortOrder++
	}

	return toListResponse(list), nil
}

func round3(f float64) float64 {
	return math.Round(f*1000) / 1000
}
