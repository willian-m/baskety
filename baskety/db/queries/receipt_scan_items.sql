-- name: CreateReceiptScanItem :one
INSERT INTO receipt_scan_items (
    receipt_scan_id, raw_text,
    parsed_name, parsed_brand, parsed_quantity, parsed_unit,
    parsed_price_per_unit_minor, parsed_total_price_minor, parsed_currency, parsed_store_name,
    confidence_score
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: ListReceiptScanItems :many
SELECT * FROM receipt_scan_items WHERE receipt_scan_id = $1 ORDER BY created_at ASC;

-- name: UpdateReceiptScanItemStatus :one
UPDATE receipt_scan_items
SET status = $2,
    corrected_name = $3,
    corrected_brand = $4,
    corrected_quantity = $5,
    corrected_price_per_unit_minor = $6,
    corrected_total_price_minor = $7,
    corrected_currency = $8,
    corrected_store_name = $9,
    corrected_unit = $10,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: LinkReceiptScanItemToInventory :exec
UPDATE receipt_scan_items
SET inventory_item_id = $2,
    corrected_unit = COALESCE($3, corrected_unit)
WHERE id = $1;
