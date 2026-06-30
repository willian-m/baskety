GO   = mise exec -- go
PNPM = pnpm

.PHONY: dev build test lint typecheck generate migrate clean dashboard \
        go-build go-test go-vet go-generate go-migrate \
        web-dev web-build \
        up down logs \
        build-up build-up-easyocr build-up-paddleocr \
        watch watch-easyocr watch-paddleocr \
        db-up db-down \
        hooks

## Backend
go-build:
	cd baskety && $(GO) build ./...

go-test:
	cd baskety && $(GO) test -race ./...

go-vet:
	cd baskety && $(GO) vet ./...

go-generate:
	cd baskety && sqlc generate

go-migrate:
	cd baskety && $(GO) run ./cmd/baskety migrate

## Frontend
web-dev:
	$(PNPM) --filter @baskety/web dev

web-build:
	$(PNPM) --filter @baskety/web... build

## Monorepo
build:
	$(PNPM) turbo run build

typecheck:
	$(PNPM) turbo run typecheck

lint:
	$(PNPM) turbo run lint

test:
	$(PNPM) turbo run test

## Docker (run from repo root)
up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

## Docker — local build/watch (run from repo root)
# Layers compose.build.yml on top of the base stack so the baskety image is built
# locally (tagged as the published name) instead of pulled.
COMPOSE_BUILD = docker compose -f docker-compose.yml -f compose.build.yml

# Build the image and bring the stack up. *-easyocr / *-paddleocr add the OCR service.
build-up:
	$(COMPOSE_BUILD) up -d --build

build-up-easyocr:
	$(COMPOSE_BUILD) --profile easyocr up -d --build

build-up-paddleocr:
	$(COMPOSE_BUILD) --profile paddleocr up -d --build

# Auto-rebuild + redeploy baskety on source changes (foreground; Ctrl-C to stop).
watch:
	$(COMPOSE_BUILD) watch

watch-easyocr:
	$(COMPOSE_BUILD) --profile easyocr watch

watch-paddleocr:
	$(COMPOSE_BUILD) --profile paddleocr watch

db-up:
	docker compose -f compose.dev.yml up -d

db-down:
	docker compose -f compose.dev.yml down

## Setup
hooks:
	cp scripts/hooks/pre-commit .git/hooks/pre-commit
	chmod +x .git/hooks/pre-commit
	@echo "Git hooks installed."

## Misc

# Open the implementation progress dashboard in your browser.
#
# Running on a remote VM? SSH tunnel first:
#   ssh -L 9000:localhost:9000 user@vm
# Then on the VM run:
#   make dashboard
# Then open: http://localhost:9000/dashboard.html
dashboard:
	@echo "Dashboard: http://localhost:9000/dashboard.html"
	@echo "Remote VM? Run this on your local machine first:"
	@echo "  ssh -L 9000:localhost:9000 user@vm"
	@echo ""
	python3 -m http.server 9000 --directory docs/superpowers/
