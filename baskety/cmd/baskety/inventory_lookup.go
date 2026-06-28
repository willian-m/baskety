package main

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/willian-m/baskety/internal/inventory"
	"github.com/willian-m/baskety/internal/receipt"
)

// receiptInventoryLookup adapts the inventory repository to the read-only
// receipt.InventoryLookup interface, letting the receipt pipeline match parsed
// line items to existing inventory items and read their stored unit without the
// receipt package depending on inventory directly.
type receiptInventoryLookup struct {
	repo inventory.Repository
}

var _ receipt.InventoryLookup = receiptInventoryLookup{}

func (l receiptInventoryLookup) HouseholdItems(ctx context.Context, householdID uuid.UUID) ([]receipt.InventoryItemRef, error) {
	invs, err := l.repo.ListInventories(ctx, householdID)
	if err != nil {
		return nil, err
	}
	var refs []receipt.InventoryItemRef
	for _, inv := range invs {
		items, err := l.repo.ListItems(ctx, inv.ID)
		if err != nil {
			return nil, err
		}
		for _, it := range items {
			refs = append(refs, receipt.InventoryItemRef{ID: it.ID, Name: it.Name, Unit: it.Unit})
		}
	}
	return refs, nil
}

func (l receiptInventoryLookup) ItemUnit(ctx context.Context, itemID uuid.UUID) (string, bool, error) {
	item, err := l.repo.GetItem(ctx, itemID)
	if err != nil {
		if errors.Is(err, inventory.ErrNotFound) {
			return "", false, nil
		}
		return "", false, err
	}
	return item.Unit, true, nil
}
