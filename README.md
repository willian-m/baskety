# Baskety
> *Cestinha* in Portuguese

A self-hosted, open-source grocery and pantry management app for families.

---

> **Agentic SDLC:** This project is being designed and implemented entirely through an agentic software development lifecycle — architecture, code, tests, and documentation are generated and evolved through structured LLM-driven sessions. See details in last section.

---

## What it does

Baskety goes beyond a simple shopping list. It tracks your home inventory — quantities, expiration dates, and target stock levels — and automatically generates a grocery list of what you need to restock. After shopping, scan your receipt and Baskety updates your inventory for you.

**Key features:**
- Shared family accounts — multiple users, one shared pantry
- Inventory tracking with expiration dates, batch quantities, and target stock levels
- Auto-generated grocery lists, prioritizing expired or low-stock items
- Receipt scanning via OCR + LLM that parses line items for review before inventory update
- Price history tracking across stores and brands over time
- Spending dashboards: habits, frequently purchased items, waste from expired goods
- Self-hostable with Docker Compose — one container, one binary, one port

---

## Quick start

**Requirements:** Docker and Docker Compose.

```bash
# 1. Copy and edit the config
cp config.yaml.example config.yaml
# Edit config.yaml: set server.public_url and database credentials

# 2. Generate an encryption key
mkdir -p secrets
openssl rand -base64 32 > secrets/baskety_key

# 3. Start
POSTGRES_PASSWORD=changeme docker compose up -d
```

Baskety will be available at `http://localhost:8080`.

---

## Deploying

### Docker Compose (recommended)

The standard deployment runs Baskety and PostgreSQL as two containers. The Go binary embeds the web frontend — no separate web server needed.

```bash
# Pull the latest image and restart
docker compose pull
docker compose up -d
```

Database migrations run automatically on startup.

### File storage

By default uploads (receipt images) are stored on the local filesystem inside the container via a named Docker volume. To use S3-compatible storage or Azure Blob, set `storage.backend` in `config.yaml`:

```yaml
storage:
  backend: s3
  s3:
    endpoint: https://s3.amazonaws.com   # or your MinIO URL
    bucket: baskety
    access_key: YOUR_KEY
    secret_key: YOUR_SECRET
```

A MinIO service is included in the Compose file for local S3-compatible storage. Enable it with:

```bash
POSTGRES_PASSWORD=changeme MINIO_ROOT_USER=baskety MINIO_ROOT_PASSWORD=changeme \
  docker compose --profile minio up -d
```

### OCR Services

Baskety supports two self-hosted OCR engines for receipt scanning, selectable via Docker Compose profiles. Both expose the same REST API on port 8000 and are reachable inside the Compose network under the `ocr` hostname.

**EasyOCR** (recommended default):

```bash
POSTGRES_PASSWORD=changeme docker compose --profile easyocr up -d
```

**PaddleOCR** (alternative, generally faster on CPU):

```bash
POSTGRES_PASSWORD=changeme docker compose --profile paddleocr up -d
```

> **Note:** OCR models download on first container start. This can take several minutes depending on your connection. Subsequent starts use the cached models from the named Docker volume.

To use a Docker OCR service, set `ocr.provider: http` in `config.yaml`. Running without a profile starts no OCR service; the default config (`provider: tesseract`) will attempt to shell out to a local `tesseract` binary — if tesseract is not installed, receipt OCR will fail with a clear error. For Docker deployments, using `--profile easyocr` or `--profile paddleocr` is the recommended path. For non-English receipts, adjust the language environment variable:

| Engine | Env var | Example |
|--------|---------|---------|
| EasyOCR | `OCR_LANGUAGES` | `OCR_LANGUAGES=en,pt` |
| PaddleOCR | `OCR_LANG` | `OCR_LANG=pt` |

See [EasyOCR language codes](https://www.jaided.ai/easyocr/) and [PaddleOCR language codes](https://paddlepaddle.github.io/PaddleOCR/latest/en/ppocr/blog/multi_languages.html) for the full list of supported languages.

### Secrets

The encryption key must never appear in `config.yaml` or environment variables. It is loaded from the path set in `encryption.key_file` (default: `/run/secrets/baskety_key`), which maps to the `secrets/baskety_key` file on your host via Docker secrets.

### Reverse proxy

Baskety listens on port `8080`. Put it behind nginx, Caddy, or Traefik for TLS termination. Set `server.public_url` in `config.yaml` to your external URL.

### Updates

```bash
docker compose pull
docker compose up -d
```

Migrations run automatically on startup. There is no manual migration step.

---

## Development

**Requirements:** Go 1.24+, Node.js 20+, pnpm 9+, Docker (for the database).

```bash
# Install git hooks
make hooks

# Start backend + database
docker compose up

# Start frontend dev server (proxies /api → :8080)
pnpm --filter web dev

# Start mobile dev server
pnpm --filter mobile start
```

For architecture decisions, tech stack rationale, project structure, and database schema see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Agentic SDLC

For those unware, SDLC stands for "Software Development Lifecycle". That means the usual loop Plan -> Implement -> Review -> Test -> Deploy -> Monitor. Agentic SDLC means that AI agents plays a significant role in this cycle.

This project is my first personal experiencce on this. It was born of a real need: a good app to do groceries list, avoid forgetting things that needed to be bought plus a curiosity what is my "personal inflation rate" at least for groceries.

> Prices of products are affected by inflation diferently. The inflation rate published by institutions and governments usually refers to standardized basket of products that should reflect the average spending of a person. But each person has different spending habits, so inflation rate mostly certainly for each person is different. This is what I am calling "personal inflation rate".

However, a development for an app like this require significant effort. So I always postponed. Until on first semester 2026 the Agentic SDLC gained traction. I saw myself on a situation where I needed to learn how to use these new tools and always genuinelly curious how far could I take them. It was when I decided to start executing this old idea using these new tools.

Thus, was born this project with the premise: execute it as fast as possible using AI only. My role was to decide the features I wanted, outline the basic architecture, coordinate the agents execution and verify the final delivery of each "sprint" (sprint here is more of a block of features that the AI delivers in a single chat session) is working as intended.

Because of this, all code and documentation is AI written. Only piece that is not AI written is, in fact, the current section. Everything else is AI generated with minor manual tweaks here and there if I believe it was needed.

## Fonts

Baskety bundles the following fonts, both licensed under the SIL Open Font
License 1.1:

- **Lora** © Cyreal — https://github.com/cyrealtype/Lora-Cyrillic
- **DM Sans** © Colophon Foundry, Jonny Pinhorn — https://github.com/googlefonts/dm-fonts

The full license text ships with each font in `node_modules/@fontsource/*/LICENSE`.
