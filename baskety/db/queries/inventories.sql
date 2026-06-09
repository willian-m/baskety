-- name: CreateInventory :one
INSERT INTO inventories (household_id, name, description)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetInventoryByID :one
SELECT * FROM inventories WHERE id = $1;

-- name: ListInventoriesByHousehold :many
SELECT * FROM inventories WHERE household_id = $1 ORDER BY created_at ASC;

-- name: UpdateInventory :one
UPDATE inventories SET name = $2, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteInventory :exec
DELETE FROM inventories WHERE id = $1;

-- name: UpsertInventoryPermission :one
INSERT INTO inventory_permissions (inventory_id, user_id, permission)
VALUES ($1, $2, $3)
ON CONFLICT (inventory_id, user_id) DO UPDATE SET permission = EXCLUDED.permission
RETURNING *;

-- name: GetInventoryPermission :one
SELECT * FROM inventory_permissions WHERE inventory_id = $1 AND user_id = $2;

-- name: ListInventoryPermissions :many
SELECT * FROM inventory_permissions WHERE inventory_id = $1;
