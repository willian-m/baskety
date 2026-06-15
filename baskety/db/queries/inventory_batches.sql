-- name: CreateInventoryBatch :one
INSERT INTO inventory_batches (item_id, quantity, expires_at, notes)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetInventoryBatchByID :one
SELECT * FROM inventory_batches WHERE id = $1;

-- name: ListActiveBatchesByItem :many
SELECT * FROM inventory_batches
WHERE item_id = $1 AND emptied_at IS NULL
ORDER BY expires_at ASC NULLS LAST;

-- name: MarkBatchEmptied :exec
UPDATE inventory_batches SET emptied_at = NOW() WHERE id = $1;

-- name: PatchBatch :one
UPDATE inventory_batches
SET
  quantity   = $2,
  expires_at = $3,
  notes      = COALESCE(sqlc.narg('notes'), notes)
WHERE id = $1 AND emptied_at IS NULL
RETURNING *;

-- name: ListExpiringBatches :many
SELECT * FROM inventory_batches
WHERE emptied_at IS NULL AND expires_at <= $1
ORDER BY expires_at ASC;
