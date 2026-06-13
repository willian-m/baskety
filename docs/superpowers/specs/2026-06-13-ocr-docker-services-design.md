# OCR Docker Services Design

**Date:** 2026-06-13  
**Status:** Implemented

---

## Problem Statement

Baskety's receipt scanning pipeline requires an OCR provider to convert receipt images into text before the LLM extraction step. The original implementation shelled out to a local `tesseract` binary, which works for development but is unsuitable for Docker-based deployments where:

1. The Baskety binary runs in a minimal container with no OCR runtime installed.
2. Self-hosters want to choose their OCR engine (accuracy vs. speed trade-off).
3. Models and weights should be cached persistently across container restarts.

The solution is to run OCR as a separate sidecar service within the Docker Compose network, exposing a simple REST API. The Go backend calls this service over HTTP rather than shelling out locally.

---

## Architecture

### Overview

```
[Baskety Go backend]
        │
        │ POST /ocr (multipart image)
        ▼
[ocr-easyocr  OR  ocr-paddleocr]   ← profile-selected
        │
        │ {"text": "..."}
        └──────────────────────────► back to backend
```

### Profile-Based Selection

Both OCR services live in `docker-compose.yml` under mutually exclusive Docker Compose profiles:

- `--profile easyocr` starts `ocr-easyocr`
- `--profile paddleocr` starts `ocr-paddleocr`

Both services register under the `ocr` network alias on the default Compose network. This means the Go backend's `ocr.endpoint_url` (`http://ocr:8000`) never changes regardless of which engine is active.

Only one profile should be active at a time. Running both simultaneously would create two containers competing for the same `ocr` alias.

### Model Persistence

Each service uses a named Docker volume for its model cache:

| Service | Volume | Path in container |
|---------|--------|-------------------|
| ocr-easyocr | `easyocr_models` | `/root/.EasyOCR` |
| ocr-paddleocr | `paddleocr_models` | `/root/.paddleocr` |

Models download automatically on first startup. Subsequent starts are fast.

---

## REST API Contract

Both services expose the same interface on port `8000`:

### `GET /health`

Returns `200 OK` when the service is ready.

```json
{"status": "ok"}
```

Used by Docker Compose healthcheck (`wget -qO- http://localhost:8000/health`).

### `POST /ocr`

**Request:** `multipart/form-data` with a single field `image` containing the receipt image file.

**Response:** `200 OK`

```json
{"text": "line 1\nline 2\nline 3"}
```

The `text` field contains all recognized text joined by newlines, in reading order. No bounding-box metadata is returned — the downstream LLM extraction step only needs raw text.

**Error responses:** Non-`200` status codes indicate failure. The Go adapter surfaces the HTTP status and response body as an error.

---

## Go HTTP Adapter

**File:** `baskety/internal/adapters/ocr/http.go`  
**Type:** `HTTPOCRAdapter`  
**Constructor:** `NewHTTPOCR(endpointURL string) *HTTPOCRAdapter`

The adapter implements `receipt.OCRProvider`:

```go
type OCRProvider interface {
    ExtractText(ctx context.Context, imagePath string) (string, error)
}
```

Implementation details:

- Opens the image file from disk and streams it as a `multipart/form-data` upload.
- Uses a 120-second HTTP client timeout to accommodate slow CPU inference.
- Propagates the caller's `context.Context` so the request is cancellable.
- Returns structured errors wrapping the underlying cause.

The compile-time interface check (`var _ receipt.OCRProvider = (*HTTPOCRAdapter)(nil)`) is intentionally omitted from `http.go` since it already exists in `adapter.go` for `TesseractOCR`. Both types implement the same interface; the check in `adapter.go` is sufficient to verify the interface is stable.

---

## Configuration

The `ocr:` section in `config.yaml`:

```yaml
ocr:
  provider: http           # "http" | "tesseract"
  endpoint_url: http://ocr:8000
  bin_path: ""             # only used when provider = tesseract
```

Provider selection logic in `main.go`:

```go
switch cfg.OCR.Provider {
case "http":
    ocrProvider = ocr.NewHTTPOCR(cfg.OCR.EndpointURL)
default:
    ocrProvider = ocr.NewTesseractOCR(cfg.OCR.BinPath)
}
```

The `default` branch keeps backward compatibility: any unrecognized provider value (including the empty string, which is the zero value when no config is present) falls back to Tesseract. The config example defaults to `provider: tesseract`; if tesseract is not installed on the host, receipt OCR will fail with a clear error. For Docker deployments, use `--profile easyocr` or `--profile paddleocr` and set `provider: http` in `config.yaml`.

---

## Language Support

| Engine | Env var | Format | Example |
|--------|---------|--------|---------|
| EasyOCR | `OCR_LANGUAGES` | comma-separated list | `en,pt,fr` |
| PaddleOCR | `OCR_LANG` | single language code | `pt` |

Language codes differ between the two engines. EasyOCR uses ISO 639-1 codes; PaddleOCR has its own mapping. See upstream documentation for the full list.

The default for both is `en` (English).

---

## Profile Usage Examples

```bash
# Production: EasyOCR (recommended, broader language support)
POSTGRES_PASSWORD=secret docker compose --profile easyocr up -d

# Production: PaddleOCR (alternative, faster CPU inference)
POSTGRES_PASSWORD=secret docker compose --profile paddleocr up -d

# Portuguese receipts with EasyOCR
OCR_LANGUAGES=en,pt POSTGRES_PASSWORD=secret docker compose --profile easyocr up -d

# Development without an OCR container
# No OCR service starts. The config defaults to provider: tesseract, so the app
# attempts to shell out to a local tesseract binary. If tesseract is not installed,
# receipt OCR will fail with a clear error.
POSTGRES_PASSWORD=secret docker compose up -d
```

---

## Trade-offs and Decisions

| Decision | Rationale |
|----------|-----------|
| Separate service rather than Python library embedded in Go | Keeps the Go binary dependency-free; Python ML stacks are large and version-sensitive |
| Profile-based selection rather than runtime toggle | Avoids running both engines simultaneously; simpler resource usage |
| Shared `ocr` network alias | Backend config (`endpoint_url`) stays constant regardless of engine choice |
| 120s HTTP timeout | PaddleOCR and EasyOCR CPU inference on large receipt images can exceed 30s |
| `default` branch for Tesseract in switch | Preserves zero-config dev experience; no breaking change for existing deployments |
