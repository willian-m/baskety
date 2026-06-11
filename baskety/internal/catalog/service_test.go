package catalog

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

type mockRepo struct {
	stores  []*Store
	entries []*CatalogEntry
	txns    []*PurchaseTransaction

	createStoreCalled bool
	createEntryScope  string
	createEntryHID    *uuid.UUID
}

func (m *mockRepo) CreateStore(ctx context.Context, name string, chainName, address *string) (*Store, error) {
	m.createStoreCalled = true
	s := &Store{ID: uuid.New(), Name: name, ChainName: chainName, Address: address}
	m.stores = append(m.stores, s)
	return s, nil
}
func (m *mockRepo) GetStore(ctx context.Context, id uuid.UUID) (*Store, error) {
	for _, s := range m.stores {
		if s.ID == id {
			return s, nil
		}
	}
	return nil, ErrNotFound
}
func (m *mockRepo) ListStores(ctx context.Context) ([]*Store, error) { return m.stores, nil }
func (m *mockRepo) UpsertStore(ctx context.Context, name string, chainName, address *string) (*Store, error) {
	return m.CreateStore(ctx, name, chainName, address)
}
func (m *mockRepo) CreateCatalogEntry(ctx context.Context, householdID *uuid.UUID, name string, brand, unit, category *string, scope string) (*CatalogEntry, error) {
	m.createEntryScope = scope
	m.createEntryHID = householdID
	e := &CatalogEntry{ID: uuid.New(), Name: name, Brand: brand, Unit: unit, Category: category, Scope: scope, HouseholdID: householdID}
	m.entries = append(m.entries, e)
	return e, nil
}
func (m *mockRepo) GetCatalogEntry(ctx context.Context, id uuid.UUID) (*CatalogEntry, error) {
	for _, e := range m.entries {
		if e.ID == id {
			return e, nil
		}
	}
	return nil, ErrNotFound
}
func (m *mockRepo) ListCatalogEntries(ctx context.Context, householdID uuid.UUID) ([]*CatalogEntry, error) {
	return m.entries, nil
}
func (m *mockRepo) UpsertCatalogEntry(ctx context.Context, householdID *uuid.UUID, name string, brand, unit, category *string, scope string) (*CatalogEntry, error) {
	return m.CreateCatalogEntry(ctx, householdID, name, brand, unit, category, scope)
}
func (m *mockRepo) GetPurchaseTransaction(ctx context.Context, id uuid.UUID) (*PurchaseTransaction, error) {
	for _, t := range m.txns {
		if t.ID == id {
			return t, nil
		}
	}
	return nil, ErrNotFound
}
func (m *mockRepo) UpdatePurchaseTransactionRefs(ctx context.Context, id uuid.UUID, storeID, catalogEntryID *uuid.UUID) error {
	return nil
}
func (m *mockRepo) ListTransactionsByHousehold(ctx context.Context, householdID uuid.UUID) ([]*PurchaseTransaction, error) {
	return m.txns, nil
}
func (m *mockRepo) ListTransactionsByCatalogEntry(ctx context.Context, catalogEntryID uuid.UUID) ([]*PurchaseTransaction, error) {
	return m.txns, nil
}

func TestCreateStoreValidatesName(t *testing.T) {
	svc := NewService(&mockRepo{})
	if _, err := svc.CreateStore(context.Background(), uuid.New(), CreateStoreRequest{}); err == nil {
		t.Fatal("expected error for empty name")
	}
}

func TestCreateStoreSuccess(t *testing.T) {
	repo := &mockRepo{}
	svc := NewService(repo)
	resp, err := svc.CreateStore(context.Background(), uuid.New(), CreateStoreRequest{Name: "Aldi"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Name != "Aldi" || !repo.createStoreCalled {
		t.Fatalf("store not created correctly: %+v", resp)
	}
}

func TestCreateCatalogEntryDefaultsScopePrivateWithHousehold(t *testing.T) {
	repo := &mockRepo{}
	svc := NewService(repo)
	hid := uuid.New()
	resp, err := svc.CreateCatalogEntry(context.Background(), hid, CreateCatalogEntryRequest{Name: "Milk"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Scope != "private" {
		t.Fatalf("expected private scope, got %q", resp.Scope)
	}
	if repo.createEntryHID == nil || *repo.createEntryHID != hid {
		t.Fatalf("expected household id set for private entry")
	}
}

func TestCreateCatalogEntryPublicHasNilHousehold(t *testing.T) {
	repo := &mockRepo{}
	svc := NewService(repo)
	_, err := svc.CreateCatalogEntry(context.Background(), uuid.New(), CreateCatalogEntryRequest{Name: "Milk", Scope: "public"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.createEntryHID != nil {
		t.Fatalf("expected nil household id for public entry")
	}
}

func TestCreateCatalogEntryRejectsBadScope(t *testing.T) {
	svc := NewService(&mockRepo{})
	if _, err := svc.CreateCatalogEntry(context.Background(), uuid.New(), CreateCatalogEntryRequest{Name: "X", Scope: "weird"}); err == nil {
		t.Fatal("expected error for invalid scope")
	}
}

func TestListTransactions(t *testing.T) {
	repo := &mockRepo{txns: []*PurchaseTransaction{{ID: uuid.New(), HouseholdID: uuid.New(), Currency: "USD"}}}
	svc := NewService(repo)
	out, err := svc.ListTransactions(context.Background(), uuid.New(), nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("expected 1 transaction, got %d", len(out))
	}
}
