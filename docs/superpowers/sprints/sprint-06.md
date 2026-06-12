# Sprint 6 — Go Backend: Receipt Scanning Domain

**Goal:** Full receipt scan state machine (upload → OCR → LLM → pending_review → commit) implemented with River background jobs and pluggable provider adapters.

**Dependencies:** Sprints 4–5.

> This sprint is 6.5d — run as a 1.5-week sprint or defer task 6.6 (Anthropic adapter) to Sprint 7.

| # | Task | Est. |
|---|------|------|
| 6.1 | Implement `internal/receipt`: `model.go`, `dto.go`, `repository.go` interface | 0.5d |
| 6.2 | Implement `receipt/repository_pg.go`: create scan, update scan status/fields, create scan items, list scan items, update scan item | 0.5d |
| 6.3 | Define `OCRProvider` interface; implement Tesseract adapter (shell out to `tesseract` CLI) | 0.5d |
| 6.4 | Define `LLMProvider` interface; implement Ollama adapter (HTTP call to local endpoint, structured JSON prompt) | 0.5d |
| 6.5 | Implement OpenAI adapter for `LLMProvider` | 0.5d |
| 6.6 | Implement Anthropic adapter for `LLMProvider` | 0.5d |
| 6.7 | Add River job queue to `cmd/baskety/main.go`; implement `ProcessReceiptScanJob`: drive OCR → LLM → persist receipt_scan_items → set status=pending_review; handle failures | 1d |
| 6.8 | Implement `receipt/service.go`: upload image (FileStore), enqueue job, get scan, get/update scan items, commit (create purchase_transactions, stamp receipt_scans.status=committed, enqueue ProcessPurchaseTransactionJob) | 1d |
| 6.9 | Implement `receipt/handler.go` + `routes.go` + `worker.go` | 0.5d |
| 6.10 | Unit tests for `receipt/service.go` (mock OCR/LLM providers, mock repository) | 0.5d |
| 6.11 | Cruncher/soft-delete integrity integration test (see backend spec Section 8) | 0.5d |

**Sprint total: 6.5d**
