-- name: CreateCatalogEntry :one
INSERT INTO catalog_entries (name, brand, unit, category, scope, household_id)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetCatalogEntryByID :one
SELECT * FROM catalog_entries WHERE id = $1;

-- name: ListCatalogEntriesByHousehold :many
SELECT * FROM catalog_entries
WHERE household_id = $1 OR household_id IS NULL
ORDER BY name ASC;

-- name: UpdateCatalogEntry :one
UPDATE catalog_entries
SET name = $2, brand = $3, unit = $4, category = $5, scope = $6, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: MergeCatalogEntry :exec
UPDATE catalog_entries SET canonical_entry_id = $2 WHERE id = $1;
