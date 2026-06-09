-- name: UpsertLLMProviderConfig :one
INSERT INTO llm_provider_configs (household_id, provider, model, endpoint_url, api_key_encrypted, is_default)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (id) DO UPDATE
SET provider = EXCLUDED.provider, model = EXCLUDED.model,
    endpoint_url = EXCLUDED.endpoint_url, api_key_encrypted = EXCLUDED.api_key_encrypted,
    is_default = EXCLUDED.is_default, updated_at = NOW()
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

-- name: UpsertOCRProviderConfig :one
INSERT INTO ocr_provider_configs (household_id, provider, endpoint_url, api_key_encrypted, extra_config, is_default)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (id) DO UPDATE
SET provider = EXCLUDED.provider, endpoint_url = EXCLUDED.endpoint_url,
    api_key_encrypted = EXCLUDED.api_key_encrypted, extra_config = EXCLUDED.extra_config,
    is_default = EXCLUDED.is_default, updated_at = NOW()
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
