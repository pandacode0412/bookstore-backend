# Local Development / Docker Compose Guide

## Directory precondition
```text
workspace/
├── bookstore-backend/       # docker-compose.yml here
└── bookstore-frontend/      # build context ../bookstore-frontend
```

## Start
```bash
cd bookstore-backend
cp .env.example .env
# Windows PowerShell: Copy-Item .env.example .env
docker compose config
docker compose up --build
```
Ports: web 3000, api 4000, postgres 5433 (host loopback). DB hostname inside Compose = `db:5432`, not localhost. Browser API URL = localhost:4000. If port 3000 is in use, start the storefront on another host port without changing its container port: `WEB_PORT=3001 docker compose up --build`.

## Test
```bash
curl http://localhost:4000/api/health
curl http://localhost:4000/api/books
curl http://localhost:4000/api/books/clean-code
curl http://localhost:4000/api/docs-json
```

Interactive API documentation: `http://localhost:4000/api/docs` (Swagger UI). The generated JSON and YAML are at `/api/docs-json` and `/api/docs-yaml`; use the checked-in `contracts/openapi.yaml` for the full planned contract.

## Category schema update (development)

Category management adds non-destructive `Category.isActive` (default `true`) and `Category.sortOrder` (default `0`) columns plus a public-navigation index. The Compose API startup already runs `prisma db push`; restart the `api` service after pulling this change. Before production, create and review a committed Prisma migration rather than using `db push`.

## Lifecycle
```bash
docker compose ps
docker compose logs -f api
docker compose logs -f web
docker compose exec api npx prisma db push
docker compose exec api npm run db:seed
docker compose down             # keep data
docker compose down -v          # destructive reset!
```

## Local environment
Backend `.env.example` is read by Compose variable substitution. Never commit `.env`. Credentials here deliberately only dev placeholders; change before shared/untrusted environment.

`db:seed` can ensure a local admin when both `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` are set; Compose passes these values only to the local API service. The current local `.env` uses `admin@gmail.com` with the password supplied for this development workspace. This account must never be used outside local development; replace the example password before sharing an environment.

## Troubleshoot
- Port in use: set `WEB_PORT` for the storefront (for example `WEB_PORT=3001 docker compose up --build`); API and database mappings are `127.0.0.1:4000:4000` and `127.0.0.1:5433:5432`.
- Next fetch error: verify `api` service, `API_INTERNAL_URL=http://api:4000/api` inside web container.
- Prisma connect error: check database healthy and env `DATABASE_URL` uses service `db`.
- Idempotency-index warning on `db push`: checkout replaces the old global `Order.idempotencyKey` index with the customer-scoped `(userId, idempotencyKey)` index. Inspect order count and duplicate keys first; if the local dev DB has no orders/duplicates, replace the legacy index or recreate the disposable DB. Do **not** blindly use `--accept-data-loss` against data that must be kept.
- First boot slow: npm install, prisma generate/db push/seed run in command. Requires Internet.
- Cache weird: `docker compose down`, then `docker compose up --build` (no `-v` unless intentionally reset database).
- Running docker compose from wrong location: use backend repo directory; sibling FE folder required.

## Dev vs production
Compose example is **dev-only**: bind mounts, hot reload, demo seed, `prisma db push`, dev passwords. Do **not** expose directly on Internet or treat as production-ready deployment.

## Database change workflow
1. Update `prisma/schema.prisma` and `docs/04-DATABASE.md`.
2. During iteration run db push locally.
3. Before release create reviewed Prisma migration (`migrate dev`) and test upgrade/rollback strategy.
4. Add CHECK constraints manually via SQL migrations where Prisma cannot represent them.
