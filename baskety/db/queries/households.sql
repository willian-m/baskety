-- name: CreateHousehold :one
INSERT INTO households (name, created_by)
VALUES ($1, $2)
RETURNING *;

-- name: GetHouseholdByID :one
SELECT * FROM households WHERE id = $1;

-- name: ListHouseholdsByUser :many
SELECT h.* FROM households h
JOIN household_members hm ON hm.household_id = h.id
WHERE hm.user_id = $1
ORDER BY h.created_at DESC;

-- name: AddHouseholdMember :one
INSERT INTO household_members (household_id, user_id, role, invited_by_user_id)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetHouseholdMember :one
SELECT * FROM household_members WHERE household_id = $1 AND user_id = $2 AND revoked_at IS NULL;

-- name: UpdateHouseholdMemberRole :one
UPDATE household_members SET role = $3
WHERE household_id = $1 AND user_id = $2
RETURNING *;

-- name: RemoveHouseholdMember :exec
DELETE FROM household_members WHERE household_id = $1 AND user_id = $2;

-- name: ListHouseholdMembers :many
SELECT * FROM household_members WHERE household_id = $1 AND revoked_at IS NULL ORDER BY joined_at ASC;

-- name: UpdateHousehold :one
UPDATE households SET name = $2, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: RevokeHouseholdMember :exec
UPDATE household_members SET revoked_at = NOW()
WHERE household_id = $1 AND user_id = $2;

-- name: SetHouseholdMemberExpiry :exec
UPDATE household_members SET expires_at = $3
WHERE household_id = $1 AND user_id = $2;
