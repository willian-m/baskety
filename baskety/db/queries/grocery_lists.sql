-- name: CreateGroceryList :one
INSERT INTO grocery_lists (inventory_id, name, created_by_user_id)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetGroceryListByID :one
SELECT * FROM grocery_lists WHERE id = $1;

-- name: ListGroceryListsByInventory :many
SELECT * FROM grocery_lists WHERE inventory_id = $1 ORDER BY created_at DESC;

-- name: UpdateGroceryListStatus :one
UPDATE grocery_lists
SET status = $2, completed_at = $3, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: PinGroceryList :exec
UPDATE grocery_lists SET pinned_at = NOW() WHERE id = $1;

-- name: ArchiveGroceryList :exec
UPDATE grocery_lists SET status = 'archived', updated_at = NOW() WHERE id = $1;

-- name: RenameGroceryList :one
UPDATE grocery_lists SET name = $2, updated_at = NOW() WHERE id = $1 RETURNING *;

-- name: DeleteGroceryList :exec
DELETE FROM grocery_lists WHERE id = $1;
