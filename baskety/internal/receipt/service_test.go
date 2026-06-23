package receipt_test

import (
	"context"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/willian-m/baskety/internal/receipt"
)

// --- mock Repository ---

type mockRepo struct {
	createScanFn   func(ctx context.Context, householdID uuid.UUID, glID *uuid.UUID, imagePath string, createdBy uuid.UUID) (*receipt.ReceiptScan, error)
	getScanFn      func(ctx context.Context, id uuid.UUID) (*receipt.ReceiptScan, error)
	listScansFn    func(ctx context.Context, householdID uuid.UUID) ([]*receipt.ReceiptScan, error)
	updateStatusFn func(ctx context.Context, id uuid.UUID, status string, errMsg *string) (*receipt.ReceiptScan, error)
	setOCRFn       func(ctx context.Context, id uuid.UUID, text string) (*receipt.ReceiptScan, error)
	setLLMFn       func(ctx context.Context, id uuid.UUID, raw string) (*receipt.ReceiptScan, error)
	createItemFn   func(ctx context.Context, scanID uuid.UUID, item receipt.ParsedLineItem) (*receipt.ReceiptScanItem, error)
	listItemsFn    func(ctx context.Context, scanID uuid.UUID) ([]*receipt.ReceiptScanItem, error)
	updateItemFn   func(ctx context.Context, id uuid.UUID, req receipt.UpdateScanItemRequest) (*receipt.ReceiptScanItem, error)
	createTxFn     func(ctx context.Context, householdID uuid.UUID, scanItemID uuid.UUID, purchasedAt time.Time) (*receipt.PurchaseTransaction, error)
}

func (m *mockRepo) CreateScan(ctx context.Context, householdID uuid.UUID, glID *uuid.UUID, imagePath string, createdBy uuid.UUID) (*receipt.ReceiptScan, error) {
	return m.createScanFn(ctx, householdID, glID, imagePath, createdBy)
}
func (m *mockRepo) GetScan(ctx context.Context, id uuid.UUID) (*receipt.ReceiptScan, error) {
	return m.getScanFn(ctx, id)
}
func (m *mockRepo) ListScansByHousehold(ctx context.Context, householdID uuid.UUID) ([]*receipt.ReceiptScan, error) {
	return m.listScansFn(ctx, householdID)
}
func (m *mockRepo) UpdateScanStatus(ctx context.Context, id uuid.UUID, status string, errMsg *string) (*receipt.ReceiptScan, error) {
	return m.updateStatusFn(ctx, id, status, errMsg)
}
func (m *mockRepo) SetOCRResult(ctx context.Context, id uuid.UUID, text string) (*receipt.ReceiptScan, error) {
	return m.setOCRFn(ctx, id, text)
}
func (m *mockRepo) SetLLMResult(ctx context.Context, id uuid.UUID, raw string) (*receipt.ReceiptScan, error) {
	return m.setLLMFn(ctx, id, raw)
}
func (m *mockRepo) CreateScanItem(ctx context.Context, scanID uuid.UUID, item receipt.ParsedLineItem) (*receipt.ReceiptScanItem, error) {
	return m.createItemFn(ctx, scanID, item)
}
func (m *mockRepo) ListScanItems(ctx context.Context, scanID uuid.UUID) ([]*receipt.ReceiptScanItem, error) {
	return m.listItemsFn(ctx, scanID)
}
func (m *mockRepo) UpdateScanItem(ctx context.Context, id uuid.UUID, req receipt.UpdateScanItemRequest) (*receipt.ReceiptScanItem, error) {
	return m.updateItemFn(ctx, id, req)
}
func (m *mockRepo) LinkScanItemToInventory(_ context.Context, _, _ uuid.UUID) error { return nil }
func (m *mockRepo) CreatePurchaseTransaction(ctx context.Context, householdID uuid.UUID, scanItemID uuid.UUID, purchasedAt time.Time) (*receipt.PurchaseTransaction, error) {
	return m.createTxFn(ctx, householdID, scanItemID, purchasedAt)
}

// --- mock FileStore ---

type mockFileStore struct {
	storeFn func(ctx context.Context, name string, r io.Reader) (string, error)
}

func (m *mockFileStore) Store(ctx context.Context, name string, r io.Reader) (string, error) {
	return m.storeFn(ctx, name, r)
}
func (m *mockFileStore) Open(ctx context.Context, path string) (io.ReadCloser, error) {
	return nil, nil
}

// --- mock JobQueue ---

type mockQueue struct {
	enqueued int
	lastType string
	lastArgs any
}

func (m *mockQueue) Enqueue(ctx context.Context, jobType string, payload any) error {
	m.enqueued++
	m.lastType = jobType
	m.lastArgs = payload
	return nil
}

func TestUploadScan_Success(t *testing.T) {
	ctx := context.Background()
	hid := uuid.New()
	uid := uuid.New()
	scanID := uuid.New()

	repo := &mockRepo{
		createScanFn: func(ctx context.Context, householdID uuid.UUID, glID *uuid.UUID, imagePath string, createdBy uuid.UUID) (*receipt.ReceiptScan, error) {
			assert.Equal(t, hid, householdID)
			assert.Equal(t, uid, createdBy)
			assert.Equal(t, "/uploads/x.jpg", imagePath)
			return &receipt.ReceiptScan{ID: scanID, HouseholdID: householdID, RawImagePath: imagePath, Status: receipt.StatusUploading, CreatedByUserID: createdBy}, nil
		},
	}
	files := &mockFileStore{storeFn: func(ctx context.Context, name string, r io.Reader) (string, error) {
		return "/uploads/x.jpg", nil
	}}
	q := &mockQueue{}

	svc := receipt.NewService(repo, files, q)
	resp, err := svc.UploadScan(ctx, hid, uid, nil, "receipt.jpg", strings.NewReader("img"))
	require.NoError(t, err)
	assert.Equal(t, receipt.StatusUploading, resp.Status)
	assert.Equal(t, 1, q.enqueued)
	assert.Equal(t, receipt.JobProcessReceiptScan, q.lastType)
	args, ok := q.lastArgs.(receipt.ProcessReceiptScanArgs)
	require.True(t, ok)
	assert.Equal(t, scanID.String(), args.ScanID)
}

func TestGetScan_WrongHousehold(t *testing.T) {
	ctx := context.Background()
	scanID := uuid.New()
	owner := uuid.New()
	caller := uuid.New()

	repo := &mockRepo{
		getScanFn: func(ctx context.Context, id uuid.UUID) (*receipt.ReceiptScan, error) {
			return &receipt.ReceiptScan{ID: scanID, HouseholdID: owner, Status: receipt.StatusPendingReview}, nil
		},
	}
	svc := receipt.NewService(repo, &mockFileStore{}, &mockQueue{})
	_, err := svc.GetScan(ctx, scanID, caller)
	require.ErrorIs(t, err, receipt.ErrNotFound)
}

func TestCommitScan_NotPendingReview(t *testing.T) {
	ctx := context.Background()
	scanID := uuid.New()
	hid := uuid.New()

	repo := &mockRepo{
		getScanFn: func(ctx context.Context, id uuid.UUID) (*receipt.ReceiptScan, error) {
			return &receipt.ReceiptScan{ID: scanID, HouseholdID: hid, Status: receipt.StatusOCRProcessing}, nil
		},
	}
	svc := receipt.NewService(repo, &mockFileStore{}, &mockQueue{})
	_, err := svc.CommitScan(ctx, scanID, hid, receipt.CommitScanRequest{PurchasedAt: time.Now()})
	require.ErrorIs(t, err, receipt.ErrInvalidInput)
}

func TestCommitScan_CreatesTransactions(t *testing.T) {
	ctx := context.Background()
	scanID := uuid.New()
	hid := uuid.New()
	acceptedID := uuid.New()
	rejectedID := uuid.New()

	var txCalls []uuid.UUID
	repo := &mockRepo{
		getScanFn: func(ctx context.Context, id uuid.UUID) (*receipt.ReceiptScan, error) {
			return &receipt.ReceiptScan{ID: scanID, HouseholdID: hid, Status: receipt.StatusPendingReview}, nil
		},
		listItemsFn: func(ctx context.Context, sid uuid.UUID) ([]*receipt.ReceiptScanItem, error) {
			return []*receipt.ReceiptScanItem{
				{ID: acceptedID, ReceiptScanID: scanID, Status: receipt.ItemStatusAccepted},
				{ID: rejectedID, ReceiptScanID: scanID, Status: receipt.ItemStatusRejected},
			}, nil
		},
		createTxFn: func(ctx context.Context, householdID uuid.UUID, scanItemID uuid.UUID, purchasedAt time.Time) (*receipt.PurchaseTransaction, error) {
			txCalls = append(txCalls, scanItemID)
			return &receipt.PurchaseTransaction{ID: uuid.New(), ReceiptScanItemID: &scanItemID}, nil
		},
		updateStatusFn: func(ctx context.Context, id uuid.UUID, status string, errMsg *string) (*receipt.ReceiptScan, error) {
			assert.Equal(t, receipt.StatusCommitted, status)
			return &receipt.ReceiptScan{ID: scanID, HouseholdID: hid, Status: status}, nil
		},
	}
	svc := receipt.NewService(repo, &mockFileStore{}, &mockQueue{})
	resp, err := svc.CommitScan(ctx, scanID, hid, receipt.CommitScanRequest{PurchasedAt: time.Now()})
	require.NoError(t, err)
	assert.Equal(t, receipt.StatusCommitted, resp.Status)
	require.Len(t, txCalls, 1, "only the accepted item should create a transaction")
	assert.Equal(t, acceptedID, txCalls[0])
}
