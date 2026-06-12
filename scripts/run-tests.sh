#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_BASE="http://localhost:8080"
WEB_BASE="http://localhost:5173"
API_PID=""
WEB_PID=""
API_EXIT=0
E2E_EXIT=0
START_TIME="$(date +%s)"

# ── Cleanup ───────────────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "==> Cleaning up..."
  [[ -n "$WEB_PID" ]] && kill "$WEB_PID" 2>/dev/null || true
  [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null || true
  # Stop docker but keep the volume so DB is inspectable after failures
  docker compose -f "$PROJECT_ROOT/compose.dev.yml" stop 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ── Prerequisites ─────────────────────────────────────────────────────────────
check_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "ERROR: '$1' not found. $2"; exit 1; }
}
check_cmd docker  "Install Docker"
check_cmd node    "Install Node.js >= 20"
check_cmd pnpm    "Install pnpm >= 9"

# Go binary: try mise-managed path first, fallback to PATH
GO_BIN="${HOME}/.local/share/mise/installs/go/1.26.4/bin/go"
if [[ ! -x "$GO_BIN" ]]; then
  GO_BIN="go"
fi
command -v "$GO_BIN" >/dev/null 2>&1 || { echo "ERROR: Go not found."; exit 1; }

# ── Postgres ──────────────────────────────────────────────────────────────────
echo ""
echo "==> Starting Postgres..."
cd "$PROJECT_ROOT"
docker compose -f compose.dev.yml up -d
echo "==> Waiting for Postgres to be healthy (up to 30s)..."
for i in $(seq 1 30); do
  if docker compose -f compose.dev.yml ps postgres 2>/dev/null | grep -q "healthy"; then
    echo "    Postgres healthy."
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "ERROR: Postgres did not become healthy in 30s"
    exit 1
  fi
  sleep 1
done

# ── Go backend ────────────────────────────────────────────────────────────────
export BASKETY_DATABASE_URL="postgres://baskety:baskety@localhost:5432/baskety?sslmode=disable"
echo ""
echo "==> Killing any existing process on port 8080..."
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
echo "==> Starting Go backend..."
cd "$PROJECT_ROOT/baskety"
"$GO_BIN" run ./cmd/baskety serve &
API_PID=$!
echo "==> Waiting for backend at $API_BASE/healthz (up to 30s)..."
for i in $(seq 1 30); do
  if curl -sf "$API_BASE/healthz" >/dev/null 2>&1; then
    echo "    Backend ready."
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "ERROR: Backend did not become ready in 30s"
    exit 1
  fi
  sleep 1
done
cd "$PROJECT_ROOT"

# ── Playwright install ────────────────────────────────────────────────────────
echo ""
echo "==> Installing Playwright dependencies..."
pnpm install --frozen-lockfile=false 2>/dev/null || pnpm install
pnpm exec playwright install --with-deps chromium

# ── Fixtures ──────────────────────────────────────────────────────────────────
mkdir -p "$PROJECT_ROOT/docs/fixtures"
if [[ ! -f "$PROJECT_ROOT/docs/fixtures/large_file_11mb.jpg" ]]; then
  echo "==> Generating 11 MB fixture file..."
  dd if=/dev/urandom of="$PROJECT_ROOT/docs/fixtures/large_file_11mb.jpg" bs=1M count=11 2>/dev/null
fi

# ── API Tests ─────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
echo "  RUNNING API TESTS (no browser)"
echo "══════════════════════════════════════════════════════"
cd "$PROJECT_ROOT"
pnpm exec playwright test --project=api 2>&1 || API_EXIT=$?

# ── Vite dev server ───────────────────────────────────────────────────────────
echo ""
echo "==> Starting Vite dev server..."
pnpm --filter @baskety/web dev &
WEB_PID=$!
echo "==> Waiting for Vite at $WEB_BASE (up to 30s)..."
for i in $(seq 1 30); do
  if curl -sf "$WEB_BASE" >/dev/null 2>&1; then
    echo "    Vite ready."
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "WARNING: Vite did not start in 30s — E2E tests may fail"
    break
  fi
  sleep 1
done

# ── E2E Browser Tests ─────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
echo "  RUNNING E2E BROWSER TESTS (Chromium)"
echo "══════════════════════════════════════════════════════"
pnpm exec playwright test --project=chromium 2>&1 || E2E_EXIT=$?

# ── Mobile Manual Checklist ───────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
echo "  MOBILE MANUAL TEST CHECKLIST (M01–M07)"
echo "  Run: pnpm --filter @baskety/mobile start"
echo "  Open Expo Go on device/simulator"
echo "══════════════════════════════════════════════════════"
echo ""
echo "  M01 [ ] First launch shows onboarding screen (not login)"
echo "  M02 [ ] Server URL check: enter http://localhost:8080 → 'Connected'"
echo "  M03 [ ] Server URL check: enter http://localhost:9999 → error"
echo "  M04 [ ] Home network profile: configure SSID; URL auto-switches on WiFi toggle"
echo "  M05 [ ] Register: fill name/email/password → success → home screen; token in AsyncStorage"
echo "  M06 [ ] Login with valid credentials → home screen"
echo "  M07 [ ] Login with invalid credentials → error message; stays on login"
echo ""

# ── Summary ───────────────────────────────────────────────────────────────────
END_TIME="$(date +%s)"
DURATION=$((END_TIME - START_TIME))

echo "══════════════════════════════════════════════════════"
echo "  TEST SUMMARY"
echo "══════════════════════════════════════════════════════"
printf "  Duration:  %dm %ds\n" $((DURATION / 60)) $((DURATION % 60))

if [[ $API_EXIT -eq 0 ]]; then
  echo "  API tests:  ✓ PASSED"
else
  echo "  API tests:  ✗ FAILED (exit code $API_EXIT)"
fi

if [[ $E2E_EXIT -eq 0 ]]; then
  echo "  E2E tests:  ✓ PASSED"
else
  echo "  E2E tests:  ✗ FAILED (exit code $E2E_EXIT)"
fi

echo "  Mobile:     MANUAL (see checklist above)"

# NOTE: R04–R09 and F05 are skipped automatically when Tesseract/Ollama are
# unavailable. This is expected behavior on developer machines without OCR.

OVERALL=0
[[ $API_EXIT -ne 0 ]] && OVERALL=1
[[ $E2E_EXIT -ne 0 ]] && OVERALL=1
exit $OVERALL
