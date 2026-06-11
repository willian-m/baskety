package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/willian-m/baskety/internal/adapters/llm"
	"github.com/willian-m/baskety/internal/adapters/ocr"
	"github.com/willian-m/baskety/internal/adapters/storage"
	"github.com/willian-m/baskety/internal/auth"
	"github.com/willian-m/baskety/internal/catalog"
	"github.com/willian-m/baskety/internal/grocery"
	"github.com/willian-m/baskety/internal/household"
	"github.com/willian-m/baskety/internal/inventory"
	"github.com/willian-m/baskety/internal/receipt"
	"github.com/willian-m/baskety/internal/settings"
	"github.com/willian-m/baskety/internal/share"
	"github.com/willian-m/baskety/internal/shared"
)

func main() {
	if err := run(context.Background(), os.Args[1:]); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, args []string) error {
	cmd := "serve"
	if len(args) > 0 {
		cmd = args[0]
	}

	cfg, err := shared.Load()
	if err != nil {
		return fmt.Errorf("loading config: %w", err)
	}

	switch cmd {
	case "migrate":
		return runMigrate(ctx, cfg)
	case "serve":
		return runServe(ctx, cfg)
	default:
		return fmt.Errorf("unknown command %q (valid: serve, migrate)", cmd)
	}
}

func runMigrate(ctx context.Context, cfg *shared.Config) error {
	pool, err := shared.NewPool(ctx, cfg.Database.URL)
	if err != nil {
		return fmt.Errorf("connecting to database: %w", err)
	}
	defer pool.Close()

	if err := shared.RunMigrations(ctx, pool); err != nil {
		return fmt.Errorf("running migrations: %w", err)
	}
	fmt.Println("migrations applied successfully")
	return nil
}

func runServe(ctx context.Context, cfg *shared.Config) error {
	pool, err := shared.NewPool(ctx, cfg.Database.URL)
	if err != nil {
		return fmt.Errorf("connecting to database: %w", err)
	}
	defer pool.Close()

	// Apply migrations on startup
	if err := shared.RunMigrations(ctx, pool); err != nil {
		return fmt.Errorf("running migrations: %w", err)
	}

	authRepo := auth.NewPgRepository(pool)
	authSvc := auth.NewService(authRepo)
	authHandler := auth.NewHandler(authSvc)

	householdRepo := household.NewPgRepository(pool)
	householdSvc := household.NewService(householdRepo)
	householdHandler := household.NewHandler(householdSvc)

	inventoryRepo := inventory.NewPgRepository(pool)
	inventorySvc := inventory.NewService(inventoryRepo)
	inventoryHandler := inventory.NewHandler(inventorySvc)
	shareHandler := share.NewHandler(householdRepo, inventoryRepo)

	groceryRepo := grocery.NewPgRepository(pool)
	grocerySvc := grocery.NewService(groceryRepo, inventorySvc)
	groceryHandler := grocery.NewHandler(grocerySvc)

	// Receipt domain: file storage + OCR/LLM adapters + in-process job queue.
	// Defaults target a self-hosted stack (local disk, Tesseract, Ollama). These
	// are configurable via env in a later sprint; see internal/adapters/*.
	fileStore := storage.NewLocalFileStore("./uploads")
	ocrProvider := ocr.NewTesseractOCR("")
	llmProvider := llm.NewOllamaLLM("", "")

	jobQueue := receipt.NewInProcessQueue(2, 64)
	receiptRepo := receipt.NewPgRepository(pool)
	receiptWorker := receipt.NewProcessReceiptScanWorker(receiptRepo, ocrProvider, llmProvider)
	jobQueue.Register(receipt.JobProcessReceiptScan, receiptWorker.HandleJob)
	defer jobQueue.Shutdown()

	receiptSvc := receipt.NewService(receiptRepo, fileStore, jobQueue)
	receiptHandler := receipt.NewHandler(receiptSvc)

	// Catalog domain: stores, catalog entries, purchase transactions. The
	// catalog worker enriches committed purchase transactions (store/catalog
	// linking + inventory batch updates) off the same in-process job queue.
	catalogRepo := catalog.NewPgRepository(pool)
	catalogSvc := catalog.NewService(catalogRepo)
	catalogHandler := catalog.NewHandler(catalogSvc)
	catalogWorker := catalog.NewProcessPurchaseTransactionWorker(catalogRepo, inventoryRepo, pool)
	jobQueue.Register(catalog.JobProcessPurchaseTransaction, catalogWorker.HandleJob)

	// Settings domain: system/household/user settings + LLM/OCR provider configs.
	settingsRepo := settings.NewPgRepository(pool)
	settingsSvc := settings.NewService(settingsRepo)
	settingsHandler := settings.NewHandler(settingsSvc)

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/healthz", shared.HealthHandler(pool))
	shared.RegisterOpenAPIRoute(r)

	r.Route("/api/v1", func(r chi.Router) {
		// public auth routes — no auth middleware
		r.Route("/auth", func(r chi.Router) {
			auth.RegisterRoutes(r, authHandler)
		})
		// public share-token routes — no auth middleware
		r.Route("/share", func(r chi.Router) {
			share.RegisterRoutes(r, shareHandler)
		})
		// authenticated routes — auth middleware only (household management does not require a pre-existing household)
		r.Group(func(r chi.Router) {
			r.Use(auth.Middleware(authRepo))
			r.Route("/households", func(r chi.Router) {
				household.RegisterRoutes(r, householdHandler)
			})
		})
		// authenticated + household-scoped routes
		r.Group(func(r chi.Router) {
			r.Use(auth.Middleware(authRepo))
			r.Use(household.ScopeMiddleware(householdRepo))
			r.Route("/inventories", func(r chi.Router) {
				inventory.RegisterRoutes(r, inventoryHandler)
				grocery.RegisterRoutes(r, groceryHandler)
			})
			r.Route("/receipts", func(r chi.Router) {
				receipt.RegisterRoutes(r, receiptHandler)
			})
			r.Route("/catalog", func(r chi.Router) {
				catalog.RegisterRoutes(r, catalogHandler)
			})
			r.Route("/settings", func(r chi.Router) {
				settings.RegisterRoutes(r, settingsHandler)
			})
		})
	})

	r.Handle("/*", shared.SPAHandler())

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Server.Port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	serverErr := make(chan error, 1)
	go func() {
		fmt.Printf("baskety listening on :%d\n", cfg.Server.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
		close(serverErr)
	}()

	select {
	case err := <-serverErr:
		return fmt.Errorf("server error: %w", err)
	case sig := <-quit:
		fmt.Printf("received signal %s, shutting down\n", sig)
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
