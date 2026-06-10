package settings

import (
	"time"

	"github.com/google/uuid"
)

type SystemSetting struct {
	Key       string
	Value     string
	UpdatedAt time.Time
}

type HouseholdSetting struct {
	HouseholdID uuid.UUID
	Key         string
	Value       string
	UpdatedAt   time.Time
}

type UserSetting struct {
	UserID    uuid.UUID
	Key       string
	Value     string
	UpdatedAt time.Time
}

type LLMProviderConfig struct {
	ID              uuid.UUID
	HouseholdID     *uuid.UUID
	Provider        string
	Model           string
	EndpointURL     *string
	APIKeyEncrypted *string
	IsDefault       bool
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type OCRProviderConfig struct {
	ID              uuid.UUID
	HouseholdID     *uuid.UUID
	Provider        string
	EndpointURL     *string
	APIKeyEncrypted *string
	ExtraConfig     *string // JSON blob as string
	IsDefault       bool
	CreatedAt       time.Time
	UpdatedAt       time.Time
}
