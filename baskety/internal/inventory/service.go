package inventory

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
)

var (
	ErrForbidden    = errors.New("forbidden")
	ErrInvalidInput = errors.New("invalid input")
)

// ServiceIface allows handler testing with mocks.
type ServiceIface interface {
	CreateInventory(ctx context.Context, householdID uuid.UUID, req CreateInventoryRequest) (*InventoryResponse, error)
	GetInventory(ctx context.Context, id, householdID uuid.UUID) (*InventoryResponse, error)
	ListInventories(ctx context.Context, householdID uuid.UUID) ([]*InventoryResponse, error)
	UpdateInventory(ctx context.Context, id, householdID uuid.UUID, req UpdateInventoryRequest) (*InventoryResponse, error)
	DeleteInventory(ctx context.Context, id, householdID uuid.UUID) error

	CreateItem(ctx context.Context, inventoryID, householdID uuid.UUID, req CreateItemRequest) (*ItemResponse, error)
	GetItem(ctx context.Context, id, householdID uuid.UUID) (*ItemResponse, error)
	ListItems(ctx context.Context, inventoryID, householdID uuid.UUID) ([]*ItemResponse, error)
	UpdateItem(ctx context.Context, id, householdID uuid.UUID, req UpdateItemRequest) (*ItemResponse, error)
	DeleteItem(ctx context.Context, id, householdID uuid.UUID) error

	AddBatch(ctx context.Context, itemID, householdID uuid.UUID, req AddBatchRequest) (*BatchResponse, error)
	ListActiveBatches(ctx context.Context, itemID, householdID uuid.UUID) ([]*BatchResponse, error)
	MarkBatchEmptied(ctx context.Context, batchID, householdID uuid.UUID) error
	GetEffectiveQuantity(ctx context.Context, itemID, householdID uuid.UUID) (float64, error)
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

var _ ServiceIface = (*Service)(nil)

// assertInventoryScope fetches an inventory and verifies it belongs to householdID.
func (s *Service) assertInventoryScope(ctx context.Context, inventoryID, householdID uuid.UUID) (*Inventory, error) {
	inv, err := s.repo.GetInventory(ctx, inventoryID)
	if err != nil {
		return nil, err
	}
	if inv.HouseholdID != householdID {
		return nil, fmt.Errorf("inventory scope: %w", ErrNotFound)
	}
	return inv, nil
}

// assertItemScope fetches an item, then verifies the parent inventory belongs to householdID.
func (s *Service) assertItemScope(ctx context.Context, itemID, householdID uuid.UUID) (*InventoryItem, error) {
	item, err := s.repo.GetItem(ctx, itemID)
	if err != nil {
		return nil, err
	}
	if _, err := s.assertInventoryScope(ctx, item.InventoryID, householdID); err != nil {
		return nil, err
	}
	return item, nil
}

// assertBatchScope fetches a batch, its item, then verifies household scope.
func (s *Service) assertBatchScope(ctx context.Context, batchID, householdID uuid.UUID) (*InventoryBatch, error) {
	batch, err := s.repo.GetBatch(ctx, batchID)
	if err != nil {
		return nil, err
	}
	if _, err := s.assertItemScope(ctx, batch.ItemID, householdID); err != nil {
		return nil, err
	}
	return batch, nil
}

// --- inventories ---

func (s *Service) CreateInventory(ctx context.Context, householdID uuid.UUID, req CreateInventoryRequest) (*InventoryResponse, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("name required: %w", ErrInvalidInput)
	}
	inv, err := s.repo.CreateInventory(ctx, householdID, req.Name, req.Description)
	if err != nil {
		return nil, fmt.Errorf("creating inventory: %w", err)
	}
	return toInventoryResponse(inv), nil
}

func (s *Service) GetInventory(ctx context.Context, id, householdID uuid.UUID) (*InventoryResponse, error) {
	inv, err := s.assertInventoryScope(ctx, id, householdID)
	if err != nil {
		return nil, err
	}
	return toInventoryResponse(inv), nil
}

func (s *Service) ListInventories(ctx context.Context, householdID uuid.UUID) ([]*InventoryResponse, error) {
	invs, err := s.repo.ListInventories(ctx, householdID)
	if err != nil {
		return nil, fmt.Errorf("listing inventories: %w", err)
	}
	out := make([]*InventoryResponse, len(invs))
	for i, inv := range invs {
		out[i] = toInventoryResponse(inv)
	}
	return out, nil
}

func (s *Service) UpdateInventory(ctx context.Context, id, householdID uuid.UUID, req UpdateInventoryRequest) (*InventoryResponse, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("name required: %w", ErrInvalidInput)
	}
	if _, err := s.assertInventoryScope(ctx, id, householdID); err != nil {
		return nil, err
	}
	inv, err := s.repo.UpdateInventory(ctx, id, req.Name, req.Description)
	if err != nil {
		return nil, fmt.Errorf("updating inventory: %w", err)
	}
	return toInventoryResponse(inv), nil
}

func (s *Service) DeleteInventory(ctx context.Context, id, householdID uuid.UUID) error {
	if _, err := s.assertInventoryScope(ctx, id, householdID); err != nil {
		return err
	}
	return s.repo.DeleteInventory(ctx, id)
}

// --- items ---

func (s *Service) CreateItem(ctx context.Context, inventoryID, householdID uuid.UUID, req CreateItemRequest) (*ItemResponse, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("name required: %w", ErrInvalidInput)
	}
	if _, err := s.assertInventoryScope(ctx, inventoryID, householdID); err != nil {
		return nil, err
	}
	item, err := s.repo.CreateItem(ctx, inventoryID, req.Name, req.Category, req.Unit, req.TargetQuantity, req.Notes)
	if err != nil {
		return nil, fmt.Errorf("creating item: %w", err)
	}
	return toItemResponse(item), nil
}

func (s *Service) GetItem(ctx context.Context, id, householdID uuid.UUID) (*ItemResponse, error) {
	item, err := s.assertItemScope(ctx, id, householdID)
	if err != nil {
		return nil, err
	}
	return toItemResponse(item), nil
}

func (s *Service) ListItems(ctx context.Context, inventoryID, householdID uuid.UUID) ([]*ItemResponse, error) {
	if _, err := s.assertInventoryScope(ctx, inventoryID, householdID); err != nil {
		return nil, err
	}
	items, err := s.repo.ListItems(ctx, inventoryID)
	if err != nil {
		return nil, fmt.Errorf("listing items: %w", err)
	}
	out := make([]*ItemResponse, len(items))
	for i, item := range items {
		out[i] = toItemResponse(item)
	}
	return out, nil
}

func (s *Service) UpdateItem(ctx context.Context, id, householdID uuid.UUID, req UpdateItemRequest) (*ItemResponse, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("name required: %w", ErrInvalidInput)
	}
	if _, err := s.assertItemScope(ctx, id, householdID); err != nil {
		return nil, err
	}
	item, err := s.repo.UpdateItem(ctx, id, req.Name, req.Category, req.Unit, req.TargetQuantity, req.Notes)
	if err != nil {
		return nil, fmt.Errorf("updating item: %w", err)
	}
	return toItemResponse(item), nil
}

func (s *Service) DeleteItem(ctx context.Context, id, householdID uuid.UUID) error {
	if _, err := s.assertItemScope(ctx, id, householdID); err != nil {
		return err
	}
	return s.repo.SoftDeleteItem(ctx, id)
}

// --- batches ---

func (s *Service) AddBatch(ctx context.Context, itemID, householdID uuid.UUID, req AddBatchRequest) (*BatchResponse, error) {
	if req.Quantity <= 0 {
		return nil, fmt.Errorf("quantity must be positive: %w", ErrInvalidInput)
	}
	if _, err := s.assertItemScope(ctx, itemID, householdID); err != nil {
		return nil, err
	}
	batch, err := s.repo.AddBatch(ctx, itemID, req.Quantity, req.ExpiresAt, req.Notes)
	if err != nil {
		return nil, fmt.Errorf("adding batch: %w", err)
	}
	return toBatchResponse(batch), nil
}

func (s *Service) ListActiveBatches(ctx context.Context, itemID, householdID uuid.UUID) ([]*BatchResponse, error) {
	if _, err := s.assertItemScope(ctx, itemID, householdID); err != nil {
		return nil, err
	}
	batches, err := s.repo.ListActiveBatches(ctx, itemID)
	if err != nil {
		return nil, fmt.Errorf("listing batches: %w", err)
	}
	out := make([]*BatchResponse, len(batches))
	for i, b := range batches {
		out[i] = toBatchResponse(b)
	}
	return out, nil
}

func (s *Service) MarkBatchEmptied(ctx context.Context, batchID, householdID uuid.UUID) error {
	if _, err := s.assertBatchScope(ctx, batchID, householdID); err != nil {
		return err
	}
	return s.repo.MarkBatchEmptied(ctx, batchID)
}

func (s *Service) GetEffectiveQuantity(ctx context.Context, itemID, householdID uuid.UUID) (float64, error) {
	if _, err := s.assertItemScope(ctx, itemID, householdID); err != nil {
		return 0, err
	}
	return s.repo.GetItemQuantity(ctx, itemID)
}
