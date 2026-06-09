-- name: CreateInventoryItem :one
INSERT INTO inventory_items (inventory_id, name, category, unit, target_quantity, notes)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetInventoryItemByID :one
SELECT * FROM inventory_items WHERE id = $1;

-- name: ListInventoryItems :many
SELECT * FROM inventory_items
WHERE inventory_id = $1 AND deleted_at IS NULL
ORDER BY name ASC;

-- name: UpdateInventoryItem :one
UPDATE inventory_items
SET name = $2, category = $3, unit = $4, target_quantity = $5, notes = $6, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: SoftDeleteInventoryItem :exec
UPDATE inventory_items SET deleted_at = NOW() WHERE id = $1;

-- name: GetInventoryItemQuantity :one
SELECT COALESCE(SUM(quantity), 0)::numeric AS total_quantity
FROM inventory_batches
WHERE item_id = $1 AND emptied_at IS NULL;
