-- name: CreateShareLink :one
INSERT INTO inventory_share_links (inventory_id, token, created_by_user_id, password_hash, expires_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetShareLinkByToken :one
SELECT * FROM inventory_share_links WHERE token = $1;

-- name: RevokeShareLink :exec
UPDATE inventory_share_links SET revoked_at = NOW() WHERE id = $1;

-- name: ListShareLinksByInventory :many
SELECT * FROM inventory_share_links WHERE inventory_id = $1 ORDER BY created_at DESC;
