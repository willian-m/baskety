-- name: CreateLLMProviderConfig :one
INSERT INTO llm_provider_configs (household_id, provider, model, endpoint_url, api_key_encrypted, is_default)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: UpdateLLMProviderConfig :one
UPDATE llm_provider_configs
SET provider = $2, model = $3, endpoint_url = $4, api_key_encrypted = $5, is_default = $6, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetDefaultLLMProvider :one
SELECT * FROM llm_provider_configs
WHERE is_default = true AND (household_id = $1 OR household_id IS NULL)
ORDER BY household_id DESC NULLS LAST
LIMIT 1;

-- name: ListLLMProviders :many
SELECT * FROM llm_provider_configs
WHERE household_id = $1 OR household_id IS NULL
ORDER BY is_default DESC, created_at ASC;

-- name: CreateOCRProviderConfig :one
INSERT INTO ocr_provider_configs (household_id, provider, endpoint_url, api_key_encrypted, extra_config, is_default)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: UpdateOCRProviderConfig :one
UPDATE ocr_provider_configs
SET provider = $2, endpoint_url = $3, api_key_encrypted = $4, extra_config = $5, is_default = $6, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetDefaultOCRProvider :one
SELECT * FROM ocr_provider_configs
WHERE is_default = true AND (household_id = $1 OR household_id IS NULL)
ORDER BY household_id DESC NULLS LAST
LIMIT 1;

-- name: ListOCRProviders :many
SELECT * FROM ocr_provider_configs
WHERE household_id = $1 OR household_id IS NULL
ORDER BY is_default DESC, created_at ASC;
