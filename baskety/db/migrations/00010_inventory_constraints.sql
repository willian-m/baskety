-- +goose Up
CREATE UNIQUE INDEX idx_inventory_items_unique_name_category
    ON inventory_items (inventory_id, lower(name), COALESCE(lower(category), ''))
    WHERE deleted_at IS NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_inventory_items_unique_name_category;
