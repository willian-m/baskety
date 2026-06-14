-- name: CreateLLMProviderConfig :one
INSERT INTO llm_provider_configs (household_id, provider, model, endpoint_url, api_key_encrypted, is_default)
VALUES ($1, $2, $3, $4, $5, $6)
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

-- name: GetDefaultOCRProvider :one
SELECT * FROM ocr_provider_configs
WHERE is_default = true AND (household_id = $1 OR household_id IS NULL)
ORDER BY household_id DESC NULLS LAST
LIMIT 1;

-- name: ListOCRProviders :many
SELECT * FROM ocr_provider_configs
WHERE household_id = $1 OR household_id IS NULL
ORDER BY is_default DESC, created_at ASC;

-- name: UpdateLLMProvider :one
UPDATE llm_provider_configs
SET provider          = @provider,
    model             = @model,
    endpoint_url      = @endpoint_url,
    api_key_encrypted = COALESCE(sqlc.narg('api_key_encrypted')::text, api_key_encrypted),
    is_default        = @is_default,
    updated_at        = NOW()
WHERE id = @id
  AND (household_id = @household_id OR (@household_id::uuid IS NULL AND household_id IS NULL))
RETURNING *;

-- name: DeleteLLMProvider :execrows
DELETE FROM llm_provider_configs
WHERE id = @id
  AND (household_id = @household_id OR (@household_id::uuid IS NULL AND household_id IS NULL));

-- name: UnsetDefaultLLMProviders :exec
UPDATE llm_provider_configs
SET is_default = false
WHERE household_id = @household_id
   OR (@household_id::uuid IS NULL AND household_id IS NULL);

-- name: UpdateOCRProvider :one
UPDATE ocr_provider_configs
SET provider          = @provider,
    endpoint_url      = @endpoint_url,
    api_key_encrypted = COALESCE(sqlc.narg('api_key_encrypted')::text, api_key_encrypted),
    extra_config      = @extra_config,
    is_default        = @is_default,
    updated_at        = NOW()
WHERE id = @id
  AND (household_id = @household_id OR (@household_id::uuid IS NULL AND household_id IS NULL))
RETURNING *;

-- name: DeleteOCRProvider :execrows
DELETE FROM ocr_provider_configs
WHERE id = @id
  AND (household_id = @household_id OR (@household_id::uuid IS NULL AND household_id IS NULL));

-- name: UnsetDefaultOCRProviders :exec
UPDATE ocr_provider_configs
SET is_default = false
WHERE household_id = @household_id
   OR (@household_id::uuid IS NULL AND household_id IS NULL);
