# Sprint 11 — Web Frontend: Receipt Review + Reports + Settings

**Goal:** Receipt upload, review, and commit flow live on web. Reports page shows price history. Settings manages provider configs.

**Dependencies:** Sprints 6–7 (APIs live); Sprint 10.

| # | Task | Est. |
|---|------|------|
| 11.1 | Implement `packages/core/queries/receipt.ts`: useStartScan, useScanStatus, useScanItems, useUpdateScanItem, useCommitScan | 0.5d |
| 11.2 | Build `/receipt` page: file picker upload, scan history list with status badges, poll scan status | 0.5d |
| 11.3 | Build `/receipt/:scanId/review` page: table of parsed line items; accept/reject/correct each item; confidence indicators; commit button gated on all items reviewed | 2d |
| 11.4 | Implement `packages/core/queries/catalog.ts`: useCatalogEntries, useStores, usePriceHistory | 0.5d |
| 11.5 | Build `/reports` page: price history per item across stores (Recharts line chart) | 1d |
| 11.6 | Build `/settings` page: household settings, LLM provider config form, OCR provider config form | 1d |

**Sprint total: 5.5d** — `/reports` (11.5) is the most deferrable if running behind.
