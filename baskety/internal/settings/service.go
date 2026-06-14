package settings

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
	GetHouseholdSetting(ctx context.Context, householdID uuid.UUID, key string) (*HouseholdSetting, error)
	UpsertHouseholdSetting(ctx context.Context, householdID uuid.UUID, key, value string) error
	GetUserSetting(ctx context.Context, userID uuid.UUID, key string) (*UserSetting, error)
	UpsertUserSetting(ctx context.Context, userID uuid.UUID, key, value string) error
	ListLLMProviders(ctx context.Context, householdID uuid.UUID) ([]*LLMProviderConfig, error)
	CreateLLMProvider(ctx context.Context, householdID uuid.UUID, req CreateLLMProviderRequest) (*LLMProviderConfig, error)
	UpdateLLMProvider(ctx context.Context, householdID, id uuid.UUID, req UpdateLLMProviderRequest) (*LLMProviderConfig, error)
	DeleteLLMProvider(ctx context.Context, householdID, id uuid.UUID) error
	ListOCRProviders(ctx context.Context, householdID uuid.UUID) ([]*OCRProviderConfig, error)
	CreateOCRProvider(ctx context.Context, householdID uuid.UUID, req CreateOCRProviderRequest) (*OCRProviderConfig, error)
	UpdateOCRProvider(ctx context.Context, householdID, id uuid.UUID, req UpdateOCRProviderRequest) (*OCRProviderConfig, error)
	DeleteOCRProvider(ctx context.Context, householdID, id uuid.UUID) error
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

var _ ServiceIface = (*Service)(nil)

func (s *Service) GetHouseholdSetting(ctx context.Context, householdID uuid.UUID, key string) (*HouseholdSetting, error) {
	if key == "" {
		return nil, fmt.Errorf("key required: %w", ErrInvalidInput)
	}
	return s.repo.GetHouseholdSetting(ctx, householdID, key)
}

func (s *Service) UpsertHouseholdSetting(ctx context.Context, householdID uuid.UUID, key, value string) error {
	if key == "" {
		return fmt.Errorf("key required: %w", ErrInvalidInput)
	}
	return s.repo.UpsertHouseholdSetting(ctx, householdID, key, value)
}

func (s *Service) GetUserSetting(ctx context.Context, userID uuid.UUID, key string) (*UserSetting, error) {
	if key == "" {
		return nil, fmt.Errorf("key required: %w", ErrInvalidInput)
	}
	return s.repo.GetUserSetting(ctx, userID, key)
}

func (s *Service) UpsertUserSetting(ctx context.Context, userID uuid.UUID, key, value string) error {
	if key == "" {
		return fmt.Errorf("key required: %w", ErrInvalidInput)
	}
	return s.repo.UpsertUserSetting(ctx, userID, key, value)
}

func (s *Service) ListLLMProviders(ctx context.Context, householdID uuid.UUID) ([]*LLMProviderConfig, error) {
	return s.repo.ListLLMProviders(ctx, householdID)
}

func (s *Service) CreateLLMProvider(ctx context.Context, householdID uuid.UUID, req CreateLLMProviderRequest) (*LLMProviderConfig, error) {
	if req.Provider == "" {
		return nil, fmt.Errorf("provider required: %w", ErrInvalidInput)
	}
	if req.Model == "" {
		return nil, fmt.Errorf("model required: %w", ErrInvalidInput)
	}
	h := householdID
	return s.repo.CreateLLMProvider(ctx, &h, req.Provider, req.Model, req.EndpointURL, req.APIKeyEncrypted, req.IsDefault)
}

func (s *Service) UpdateLLMProvider(ctx context.Context, householdID, id uuid.UUID, req UpdateLLMProviderRequest) (*LLMProviderConfig, error) {
	if req.Provider == "" {
		return nil, fmt.Errorf("provider required: %w", ErrInvalidInput)
	}
	if req.Model == "" {
		return nil, fmt.Errorf("model required: %w", ErrInvalidInput)
	}
	h := householdID
	return s.repo.UpdateLLMProvider(ctx, id, &h, req)
}

func (s *Service) DeleteLLMProvider(ctx context.Context, householdID, id uuid.UUID) error {
	h := householdID
	return s.repo.DeleteLLMProvider(ctx, id, &h)
}

func (s *Service) ListOCRProviders(ctx context.Context, householdID uuid.UUID) ([]*OCRProviderConfig, error) {
	return s.repo.ListOCRProviders(ctx, householdID)
}

func (s *Service) CreateOCRProvider(ctx context.Context, householdID uuid.UUID, req CreateOCRProviderRequest) (*OCRProviderConfig, error) {
	if req.Provider == "" {
		return nil, fmt.Errorf("provider required: %w", ErrInvalidInput)
	}
	valid := map[string]bool{
		"tesseract": true, "google_vision": true,
		"aws_textract": true, "azure": true, "custom": true,
	}
	if !valid[req.Provider] {
		return nil, fmt.Errorf("provider must be one of: tesseract, google_vision, aws_textract, azure, custom: %w", ErrInvalidInput)
	}
	h := householdID
	return s.repo.CreateOCRProvider(ctx, &h, req.Provider, req.EndpointURL, req.APIKeyEncrypted, req.ExtraConfig, req.IsDefault)
}

func (s *Service) UpdateOCRProvider(ctx context.Context, householdID, id uuid.UUID, req UpdateOCRProviderRequest) (*OCRProviderConfig, error) {
	if req.Provider == "" {
		return nil, fmt.Errorf("provider required: %w", ErrInvalidInput)
	}
	h := householdID
	return s.repo.UpdateOCRProvider(ctx, id, &h, req)
}

func (s *Service) DeleteOCRProvider(ctx context.Context, householdID, id uuid.UUID) error {
	h := householdID
	return s.repo.DeleteOCRProvider(ctx, id, &h)
}
