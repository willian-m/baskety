-- name: GetSystemSetting :one
SELECT * FROM system_settings WHERE key = $1;

-- name: UpsertSystemSetting :exec
INSERT INTO system_settings (key, value)
VALUES ($1, $2)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- name: GetHouseholdSetting :one
SELECT * FROM household_settings WHERE household_id = $1 AND key = $2;

-- name: UpsertHouseholdSetting :exec
INSERT INTO household_settings (household_id, key, value)
VALUES ($1, $2, $3)
ON CONFLICT (household_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- name: GetUserSetting :one
SELECT * FROM user_settings WHERE user_id = $1 AND key = $2;

-- name: UpsertUserSetting :exec
INSERT INTO user_settings (user_id, key, value)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
