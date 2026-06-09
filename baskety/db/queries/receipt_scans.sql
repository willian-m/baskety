-- name: CreateReceiptScan :one
INSERT INTO receipt_scans (household_id, grocery_list_id, raw_image_path, created_by_user_id)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetReceiptScanByID :one
SELECT * FROM receipt_scans WHERE id = $1;

-- name: ListReceiptScansByHousehold :many
SELECT * FROM receipt_scans WHERE household_id = $1 ORDER BY created_at DESC;

-- name: UpdateReceiptScanStatus :one
UPDATE receipt_scans
SET status = $2, error_message = $3, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: SetReceiptScanOCRResult :one
UPDATE receipt_scans
SET ocr_text = $2, status = 'llm_processing', updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: SetReceiptScanLLMResult :one
UPDATE receipt_scans
SET llm_raw_response = $2, status = 'pending_review', updated_at = NOW()
WHERE id = $1
RETURNING *;
