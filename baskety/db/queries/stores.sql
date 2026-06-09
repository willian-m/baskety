-- name: CreateStore :one
INSERT INTO stores (name, chain_name, address)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetStoreByID :one
SELECT * FROM stores WHERE id = $1;

-- name: ListStores :many
SELECT * FROM stores WHERE canonical_store_id IS NULL ORDER BY name ASC;

-- name: UpdateStore :one
UPDATE stores SET name = $2, chain_name = $3, address = $4, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: MergeStore :exec
UPDATE stores SET canonical_store_id = $2 WHERE id = $1;
