package catalog

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
	CreateStore(ctx context.Context, householdID uuid.UUID, req CreateStoreRequest) (*StoreResponse, error)
	ListStores(ctx context.Context, householdID uuid.UUID) ([]*StoreResponse, error)
	CreateCatalogEntry(ctx context.Context, householdID uuid.UUID, req CreateCatalogEntryRequest) (*CatalogEntryResponse, error)
	ListCatalogEntries(ctx context.Context, householdID uuid.UUID) ([]*CatalogEntryResponse, error)
	ListTransactions(ctx context.Context, householdID uuid.UUID, catalogEntryID *uuid.UUID) ([]*TransactionResponse, error)
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

var _ ServiceIface = (*Service)(nil)

func (s *Service) CreateStore(ctx context.Context, householdID uuid.UUID, req CreateStoreRequest) (*StoreResponse, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("name required: %w", ErrInvalidInput)
	}
	store, err := s.repo.CreateStore(ctx, req.Name, req.ChainName, req.Address)
	if err != nil {
		return nil, fmt.Errorf("creating store: %w", err)
	}
	return toStoreResponse(store), nil
}

func (s *Service) ListStores(ctx context.Context, householdID uuid.UUID) ([]*StoreResponse, error) {
	stores, err := s.repo.ListStores(ctx)
	if err != nil {
		return nil, fmt.Errorf("listing stores: %w", err)
	}
	out := make([]*StoreResponse, len(stores))
	for i, st := range stores {
		out[i] = toStoreResponse(st)
	}
	return out, nil
}

func (s *Service) CreateCatalogEntry(ctx context.Context, householdID uuid.UUID, req CreateCatalogEntryRequest) (*CatalogEntryResponse, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("name required: %w", ErrInvalidInput)
	}
	scope := req.Scope
	if scope == "" {
		scope = "private"
	}
	if scope != "public" && scope != "private" {
		return nil, fmt.Errorf("scope must be public or private: %w", ErrInvalidInput)
	}
	// Private entries are owned by the household; public entries are global.
	var hid *uuid.UUID
	if scope == "private" {
		h := householdID
		hid = &h
	}
	entry, err := s.repo.CreateCatalogEntry(ctx, hid, req.Name, req.Brand, req.Unit, req.Category, scope)
	if err != nil {
		return nil, fmt.Errorf("creating catalog entry: %w", err)
	}
	return toCatalogEntryResponse(entry), nil
}

func (s *Service) ListCatalogEntries(ctx context.Context, householdID uuid.UUID) ([]*CatalogEntryResponse, error) {
	entries, err := s.repo.ListCatalogEntries(ctx, householdID)
	if err != nil {
		return nil, fmt.Errorf("listing catalog entries: %w", err)
	}
	out := make([]*CatalogEntryResponse, len(entries))
	for i, e := range entries {
		out[i] = toCatalogEntryResponse(e)
	}
	return out, nil
}

func (s *Service) ListTransactions(ctx context.Context, householdID uuid.UUID, catalogEntryID *uuid.UUID) ([]*TransactionResponse, error) {
	var (
		txns []*PurchaseTransaction
		err  error
	)
	if catalogEntryID != nil {
		txns, err = s.repo.ListTransactionsByCatalogEntry(ctx, *catalogEntryID)
	} else {
		txns, err = s.repo.ListTransactionsByHousehold(ctx, householdID)
	}
	if err != nil {
		return nil, fmt.Errorf("listing transactions: %w", err)
	}
	out := make([]*TransactionResponse, len(txns))
	for i, t := range txns {
		out[i] = toTransactionResponse(t)
	}
	return out, nil
}
