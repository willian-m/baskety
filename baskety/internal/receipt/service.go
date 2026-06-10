package receipt

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"path/filepath"

	"github.com/google/uuid"
	"github.com/willian-m/baskety/internal/catalog"
	"github.com/willian-m/baskety/internal/shared"
)

// Re-export the catalog job constants/payload so the receipt service can enqueue
// post-commit enrichment without the wiring layer reaching across packages.
const JobProcessPurchaseTransaction = catalog.JobProcessPurchaseTransaction

type ProcessPurchaseTransactionArgs = catalog.ProcessPurchaseTransactionArgs

var (
	ErrForbidden    = errors.New("forbidden")
	ErrInvalidInput = errors.New("invalid input")
)

// ServiceIface allows handler testing with mocks.
type ServiceIface interface {
	UploadScan(ctx context.Context, householdID, userID uuid.UUID, groceryListID *uuid.UUID, filename string, r io.Reader) (*ScanResponse, error)
	GetScan(ctx context.Context, id, householdID uuid.UUID) (*ScanResponse, error)
	ListScans(ctx context.Context, householdID uuid.UUID) ([]*ScanResponse, error)
	GetScanItems(ctx context.Context, scanID, householdID uuid.UUID) ([]*ScanItemResponse, error)
	UpdateScanItem(ctx context.Context, itemID, scanID, householdID uuid.UUID, req UpdateScanItemRequest) (*ScanItemResponse, error)
	CommitScan(ctx context.Context, scanID, householdID uuid.UUID, req CommitScanRequest) (*ScanResponse, error)
}

type Service struct {
	repo  Repository
	files shared.FileStore
	queue JobQueue
}

func NewService(repo Repository, files shared.FileStore, queue JobQueue) *Service {
	return &Service{repo: repo, files: files, queue: queue}
}

var _ ServiceIface = (*Service)(nil)

// assertScanScope loads a scan and verifies it belongs to householdID.
func (s *Service) assertScanScope(ctx context.Context, scanID, householdID uuid.UUID) (*ReceiptScan, error) {
	scan, err := s.repo.GetScan(ctx, scanID)
	if err != nil {
		return nil, err
	}
	if scan.HouseholdID != householdID {
		return nil, fmt.Errorf("scan scope: %w", ErrNotFound)
	}
	return scan, nil
}

func (s *Service) UploadScan(ctx context.Context, householdID, userID uuid.UUID, groceryListID *uuid.UUID, filename string, r io.Reader) (*ScanResponse, error) {
	if r == nil {
		return nil, fmt.Errorf("image required: %w", ErrInvalidInput)
	}
	// Generate a unique, extension-preserving storage name.
	ext := filepath.Ext(filename)
	storeName := uuid.NewString() + ext

	path, err := s.files.Store(ctx, storeName, r)
	if err != nil {
		return nil, fmt.Errorf("storing image: %w", err)
	}

	scan, err := s.repo.CreateScan(ctx, householdID, groceryListID, path, userID)
	if err != nil {
		return nil, fmt.Errorf("creating scan: %w", err)
	}

	if err := s.queue.Enqueue(ctx, JobProcessReceiptScan, ProcessReceiptScanArgs{ScanID: scan.ID.String()}); err != nil {
		return nil, fmt.Errorf("enqueuing scan job: %w", err)
	}
	return toScanResponse(scan), nil
}

func (s *Service) GetScan(ctx context.Context, id, householdID uuid.UUID) (*ScanResponse, error) {
	scan, err := s.assertScanScope(ctx, id, householdID)
	if err != nil {
		return nil, err
	}
	return toScanResponse(scan), nil
}

func (s *Service) ListScans(ctx context.Context, householdID uuid.UUID) ([]*ScanResponse, error) {
	scans, err := s.repo.ListScansByHousehold(ctx, householdID)
	if err != nil {
		return nil, fmt.Errorf("listing scans: %w", err)
	}
	out := make([]*ScanResponse, len(scans))
	for i, sc := range scans {
		out[i] = toScanResponse(sc)
	}
	return out, nil
}

func (s *Service) GetScanItems(ctx context.Context, scanID, householdID uuid.UUID) ([]*ScanItemResponse, error) {
	if _, err := s.assertScanScope(ctx, scanID, householdID); err != nil {
		return nil, err
	}
	items, err := s.repo.ListScanItems(ctx, scanID)
	if err != nil {
		return nil, fmt.Errorf("listing scan items: %w", err)
	}
	out := make([]*ScanItemResponse, len(items))
	for i, it := range items {
		out[i] = toScanItemResponse(it)
	}
	return out, nil
}

func (s *Service) UpdateScanItem(ctx context.Context, itemID, scanID, householdID uuid.UUID, req UpdateScanItemRequest) (*ScanItemResponse, error) {
	switch req.Status {
	case ItemStatusPending, ItemStatusAccepted, ItemStatusRejected, ItemStatusCorrected:
	default:
		return nil, fmt.Errorf("invalid item status %q: %w", req.Status, ErrInvalidInput)
	}
	if _, err := s.assertScanScope(ctx, scanID, householdID); err != nil {
		return nil, err
	}
	// Verify the item belongs to this scan.
	items, err := s.repo.ListScanItems(ctx, scanID)
	if err != nil {
		return nil, fmt.Errorf("loading scan items: %w", err)
	}
	found := false
	for _, it := range items {
		if it.ID == itemID {
			found = true
			break
		}
	}
	if !found {
		return nil, fmt.Errorf("scan item not in scan: %w", ErrNotFound)
	}

	updated, err := s.repo.UpdateScanItem(ctx, itemID, req)
	if err != nil {
		return nil, fmt.Errorf("updating scan item: %w", err)
	}
	return toScanItemResponse(updated), nil
}

func (s *Service) CommitScan(ctx context.Context, scanID, householdID uuid.UUID, req CommitScanRequest) (*ScanResponse, error) {
	scan, err := s.assertScanScope(ctx, scanID, householdID)
	if err != nil {
		return nil, err
	}
	if scan.Status != StatusPendingReview {
		return nil, fmt.Errorf("scan must be pending_review to commit (got %q): %w", scan.Status, ErrInvalidInput)
	}

	items, err := s.repo.ListScanItems(ctx, scanID)
	if err != nil {
		return nil, fmt.Errorf("loading scan items: %w", err)
	}

	var txnIDs []uuid.UUID
	for _, it := range items {
		if it.Status == ItemStatusAccepted || it.Status == ItemStatusCorrected {
			txn, err := s.repo.CreatePurchaseTransaction(ctx, householdID, it.ID, req.PurchasedAt)
			if err != nil {
				return nil, fmt.Errorf("creating purchase transaction: %w", err)
			}
			txnIDs = append(txnIDs, txn.ID)
		}
	}

	committed, err := s.repo.UpdateScanStatus(ctx, scanID, StatusCommitted, nil)
	if err != nil {
		return nil, fmt.Errorf("committing scan: %w", err)
	}

	// Enqueue post-commit enrichment (store/catalog linking + inventory update)
	// for each created transaction. Enqueue failures are logged but do not fail
	// the commit, since the transactions are already persisted.
	for _, id := range txnIDs {
		if err := s.queue.Enqueue(ctx, JobProcessPurchaseTransaction, ProcessPurchaseTransactionArgs{TransactionID: id.String()}); err != nil {
			slog.Error("enqueue process_purchase_transaction failed", "transaction_id", id.String(), "error", err)
		}
	}

	return toScanResponse(committed), nil
}
