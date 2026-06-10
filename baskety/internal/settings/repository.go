package settings

import (
	"context"

	"github.com/google/uuid"
)

type Repository interface {
	GetSystemSetting(ctx context.Context, key string) (*SystemSetting, error)
	UpsertSystemSetting(ctx context.Context, key, value string) error
	GetHouseholdSetting(ctx context.Context, householdID uuid.UUID, key string) (*HouseholdSetting, error)
	UpsertHouseholdSetting(ctx context.Context, householdID uuid.UUID, key, value string) error
	GetUserSetting(ctx context.Context, userID uuid.UUID, key string) (*UserSetting, error)
	UpsertUserSetting(ctx context.Context, userID uuid.UUID, key, value string) error

	// provider configs
	CreateLLMProvider(ctx context.Context, householdID *uuid.UUID, provider, model string, endpointURL, apiKeyEncrypted *string, isDefault bool) (*LLMProviderConfig, error)
	GetDefaultLLMProvider(ctx context.Context, householdID uuid.UUID) (*LLMProviderConfig, error)
	ListLLMProviders(ctx context.Context, householdID uuid.UUID) ([]*LLMProviderConfig, error)
	CreateOCRProvider(ctx context.Context, householdID *uuid.UUID, provider string, endpointURL, apiKeyEncrypted *string, extraConfig *string, isDefault bool) (*OCRProviderConfig, error)
	GetDefaultOCRProvider(ctx context.Context, householdID uuid.UUID) (*OCRProviderConfig, error)
	ListOCRProviders(ctx context.Context, householdID uuid.UUID) ([]*OCRProviderConfig, error)
}
