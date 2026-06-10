package settings

import "time"

// --- Requests ---

type UpsertSettingRequest struct {
	Value string `json:"value"`
}

type CreateLLMProviderRequest struct {
	Provider        string  `json:"provider"`
	Model           string  `json:"model"`
	EndpointURL     *string `json:"endpoint_url"`
	APIKeyEncrypted *string `json:"api_key_encrypted"`
	IsDefault       bool    `json:"is_default"`
}

type CreateOCRProviderRequest struct {
	Provider        string  `json:"provider"`
	EndpointURL     *string `json:"endpoint_url"`
	APIKeyEncrypted *string `json:"api_key_encrypted"`
	ExtraConfig     *string `json:"extra_config"`
	IsDefault       bool    `json:"is_default"`
}

// --- Responses ---

type SettingResponse struct {
	Key       string    `json:"key"`
	Value     string    `json:"value"`
	UpdatedAt time.Time `json:"updated_at"`
}

type LLMProviderResponse struct {
	ID          string    `json:"id"`
	HouseholdID *string   `json:"household_id"`
	Provider    string    `json:"provider"`
	Model       string    `json:"model"`
	EndpointURL *string   `json:"endpoint_url"`
	HasAPIKey   bool      `json:"has_api_key"`
	IsDefault   bool      `json:"is_default"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type OCRProviderResponse struct {
	ID          string    `json:"id"`
	HouseholdID *string   `json:"household_id"`
	Provider    string    `json:"provider"`
	EndpointURL *string   `json:"endpoint_url"`
	HasAPIKey   bool      `json:"has_api_key"`
	ExtraConfig *string   `json:"extra_config"`
	IsDefault   bool      `json:"is_default"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
