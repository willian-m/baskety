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
SELECT * FROM household_members WHERE household_id = $1 AND user_id = $2;

-- name: UpdateHouseholdMemberRole :one
UPDATE household_members SET role = $3
WHERE household_id = $1 AND user_id = $2
RETURNING *;

-- name: RemoveHouseholdMember :exec
DELETE FROM household_members WHERE household_id = $1 AND user_id = $2;

-- name: ListHouseholdMembers :many
SELECT * FROM household_members WHERE household_id = $1 ORDER BY joined_at ASC;
