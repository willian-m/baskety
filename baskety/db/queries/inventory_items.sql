-- name: CreateInventoryItem :one
INSERT INTO inventory_items (inventory_id, name, category, unit, target_quantity, notes)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetInventoryItemByID :one
SELECT * FROM inventory_items WHERE id = $1;

-- name: ListInventoryItems :many
SELECT
    i.id, i.inventory_id, i.name, i.category, i.unit, i.target_quantity,
    i.notes, i.deleted_at, i.created_at, i.updated_at,
    COALESCE(SUM(b.quantity), 0)::numeric AS stored_quantity,
    COUNT(b.id)::bigint AS batch_count
FROM inventory_items i
LEFT JOIN inventory_batches b ON b.item_id = i.id AND b.emptied_at IS NULL
WHERE i.inventory_id = $1 AND i.deleted_at IS NULL
GROUP BY i.id, i.inventory_id, i.name, i.category, i.unit, i.target_quantity,
         i.notes, i.deleted_at, i.created_at, i.updated_at
ORDER BY i.name ASC;

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

-- name: ListItemsBelowTarget :many
SELECT i.*, COALESCE(SUM(b.quantity) FILTER (WHERE b.emptied_at IS NULL), 0)::numeric AS on_hand
FROM inventory_items i
LEFT JOIN inventory_batches b ON b.item_id = i.id
WHERE i.inventory_id = $1 AND i.deleted_at IS NULL
GROUP BY i.id
HAVING COALESCE(SUM(b.quantity) FILTER (WHERE b.emptied_at IS NULL), 0) < i.target_quantity
ORDER BY i.name ASC;
