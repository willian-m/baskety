GO   = mise exec -- go
PNPM = pnpm

.PHONY: dev build test lint typecheck generate migrate clean dashboard \
        go-build go-test go-vet go-generate go-migrate \
        web-dev web-build \
        up down logs

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
