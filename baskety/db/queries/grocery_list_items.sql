-- name: AddGroceryListItem :one
INSERT INTO grocery_list_items (grocery_list_id, inventory_item_id, name, quantity, unit, notes, sort_order)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetGroceryListItemByID :one
SELECT * FROM grocery_list_items WHERE id = $1;

-- name: ListGroceryListItems :many
SELECT * FROM grocery_list_items
WHERE grocery_list_id = $1
ORDER BY sort_order ASC, created_at ASC;

-- name: UpdateGroceryListItemStatus :one
UPDATE grocery_list_items
SET status = $2, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateGroceryListItemSortOrder :exec
UPDATE grocery_list_items SET sort_order = $2 WHERE id = $1;

-- name: DeleteGroceryListItem :exec
DELETE FROM grocery_list_items WHERE id = $1;
