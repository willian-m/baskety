package receipt

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Repository interface {
	CreateScan(ctx context.Context, householdID uuid.UUID, groceryListID *uuid.UUID, imagePath string, createdBy uuid.UUID) (*ReceiptScan, error)
	GetScan(ctx context.Context, id uuid.UUID) (*ReceiptScan, error)
	ListScansByHousehold(ctx context.Context, householdID uuid.UUID) ([]*ReceiptScan, error)
	UpdateScanStatus(ctx context.Context, id uuid.UUID, status string, errMsg *string) (*ReceiptScan, error)
	SetOCRResult(ctx context.Context, id uuid.UUID, ocrText string) (*ReceiptScan, error)
	SetLLMResult(ctx context.Context, id uuid.UUID, llmRaw string) (*ReceiptScan, error)

	CreateScanItem(ctx context.Context, scanID uuid.UUID, item ParsedLineItem) (*ReceiptScanItem, error)
	ListScanItems(ctx context.Context, scanID uuid.UUID) ([]*ReceiptScanItem, error)
	UpdateScanItem(ctx context.Context, id uuid.UUID, req UpdateScanItemRequest) (*ReceiptScanItem, error)
	LinkScanItemToInventory(ctx context.Context, scanItemID, inventoryItemID uuid.UUID, unit *string) error

	CreatePurchaseTransaction(ctx context.Context, householdID uuid.UUID, scanItemID uuid.UUID, purchasedAt time.Time) (*PurchaseTransaction, error)
}
