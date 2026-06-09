-- name: CreatePurchaseTransaction :one
INSERT INTO purchase_transactions (
    household_id, store_id, grocery_list_item_id, receipt_scan_item_id,
    catalog_entry_id, price_per_unit_minor, currency, quantity, purchased_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: GetPurchaseTransactionByID :one
SELECT * FROM purchase_transactions WHERE id = $1;

-- name: ListPurchaseTransactionsByHousehold :many
SELECT * FROM purchase_transactions
WHERE household_id = $1
ORDER BY purchased_at DESC;

-- name: ListPurchaseTransactionsByCatalogEntry :many
SELECT * FROM purchase_transactions
WHERE catalog_entry_id = $1
ORDER BY purchased_at DESC;
