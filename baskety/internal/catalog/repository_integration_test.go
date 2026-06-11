package catalog_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/willian-m/baskety/internal/catalog"
	"github.com/willian-m/baskety/internal/testutil"
)

// seedHousehold inserts a user + household and returns the household ID.
func seedHousehold(ctx context.Context, t *testing.T, pool *pgxpool.Pool) uuid.UUID {
	t.Helper()
	var userID uuid.UUID
	err := pool.QueryRow(ctx,
		`INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id`,
		uuid.NewString()+"@example.com", "Test User", "hash",
	).Scan(&userID)
	require.NoError(t, err)

	var householdID uuid.UUID
	err = pool.QueryRow(ctx,
		`INSERT INTO households (name, created_by) VALUES ($1, $2) RETURNING id`,
		"Test Household", userID,
	).Scan(&householdID)
	require.NoError(t, err)
	return householdID
}

// seedTransaction inserts a purchase_transaction directly and returns its ID.
func seedTransaction(ctx context.Context, t *testing.T, pool *pgxpool.Pool, householdID uuid.UUID, catalogEntryID uuid.UUID, purchasedAt time.Time) uuid.UUID {
	t.Helper()
	var txID uuid.UUID
	err := pool.QueryRow(ctx,
		`INSERT INTO purchase_transactions (household_id, catalog_entry_id, currency, purchased_at)
		 VALUES ($1, $2, 'USD', $3) RETURNING id`,
		householdID, catalogEntryID, purchasedAt,
	).Scan(&txID)
	require.NoError(t, err)
	return txID
}

func TestIntegration_Catalog_StoreUpsertIdempotency(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)
	repo := catalog.NewPgRepository(pool)

	storeName := "SuperMart " + uuid.NewString()

	// First upsert: creates the store.
	s1, err := repo.UpsertStore(ctx, storeName, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, s1)

	// Second upsert with same name: must return existing store without creating a duplicate.
	s2, err := repo.UpsertStore(ctx, storeName, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, s2)

	assert.Equal(t, s1.ID, s2.ID, "second UpsertStore with same name must return the same ID")

	// ListStores must not contain duplicates for this name.
	stores, err := repo.ListStores(ctx)
	require.NoError(t, err)

	count := 0
	for _, s := range stores {
		if s.Name == storeName {
			count++
		}
	}
	assert.Equal(t, 1, count, "ListStores must show exactly one entry for the upserted store name")
}

func TestIntegration_Catalog_EntryUpsertIdempotency(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)
	repo := catalog.NewPgRepository(pool)

	householdID := seedHousehold(ctx, t, pool)
	entryName := "Whole Milk " + uuid.NewString()
	brand := "FarmFresh"

	// First upsert: creates the catalog entry.
	e1, err := repo.UpsertCatalogEntry(ctx, &householdID, entryName, &brand, nil, nil, "private")
	require.NoError(t, err)
	require.NotNil(t, e1)

	// Second upsert with same (name, brand, household): must return existing entry.
	e2, err := repo.UpsertCatalogEntry(ctx, &householdID, entryName, &brand, nil, nil, "private")
	require.NoError(t, err)
	require.NotNil(t, e2)

	assert.Equal(t, e1.ID, e2.ID, "second UpsertCatalogEntry with same name+brand must return the same ID")

	// ListCatalogEntries must not contain duplicates.
	entries, err := repo.ListCatalogEntries(ctx, householdID)
	require.NoError(t, err)

	count := 0
	for _, e := range entries {
		if e.Name == entryName {
			count++
		}
	}
	assert.Equal(t, 1, count, "ListCatalogEntries must show exactly one entry for the upserted catalog name")
}

func TestIntegration_Catalog_PriceHistoryOrdering(t *testing.T) {
	if testing.Short() {
		t.Skip("requires docker")
	}
	ctx := context.Background()
	pool := testutil.NewTestDB(t)
	repo := catalog.NewPgRepository(pool)

	householdID := seedHousehold(ctx, t, pool)

	// Create a catalog entry to link transactions to.
	entryName := "Orange Juice " + uuid.NewString()
	entry, err := repo.CreateCatalogEntry(ctx, &householdID, entryName, nil, nil, nil, "private")
	require.NoError(t, err)

	// Also create a second catalog entry to ensure transactions are filtered correctly.
	otherEntry, err := repo.CreateCatalogEntry(ctx, &householdID, "Other Item "+uuid.NewString(), nil, nil, nil, "private")
	require.NoError(t, err)

	now := time.Now().UTC().Truncate(time.Second)

	// Seed three transactions at different times (oldest to newest).
	oldest := now.Add(-48 * time.Hour)
	middle := now.Add(-24 * time.Hour)
	newest := now

	tx1ID := seedTransaction(ctx, t, pool, householdID, entry.ID, oldest)
	tx2ID := seedTransaction(ctx, t, pool, householdID, entry.ID, middle)
	tx3ID := seedTransaction(ctx, t, pool, householdID, entry.ID, newest)

	// Seed a transaction for the other entry — it must NOT appear in our results.
	_ = seedTransaction(ctx, t, pool, householdID, otherEntry.ID, now)

	txs, err := repo.ListTransactionsByCatalogEntry(ctx, entry.ID)
	require.NoError(t, err)

	// Must return exactly the 3 transactions for this catalog entry.
	require.Len(t, txs, 3, "must return exactly the seeded transactions for this catalog entry")

	// Verify all returned transactions belong to the correct catalog entry.
	for _, tx := range txs {
		require.NotNil(t, tx.CatalogEntryID)
		assert.Equal(t, entry.ID, *tx.CatalogEntryID, "every returned transaction must belong to the queried catalog entry")
	}

	// Verify ordering: most recent first (purchased_at DESC).
	assert.Equal(t, tx3ID, txs[0].ID, "first result must be the most recently purchased transaction")
	assert.Equal(t, tx2ID, txs[1].ID, "second result must be the middle transaction")
	assert.Equal(t, tx1ID, txs[2].ID, "third result must be the oldest transaction")
}
