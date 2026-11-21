# Local development

1. Copy `.env.example` to `.env`; replace the two local-only secret placeholders with random values.
2. Run `pnpm install` and `docker compose up -d postgres`.
3. Run `pnpm db:migrate && pnpm db:seed && pnpm dev`.
4. Sign in with `demo@contentforge.dev`; the console email provider prints the magic link.

No Docker fallback: `pnpm --filter @contentforge/database dev:db` starts embedded PostgreSQL on port 55432; update `DATABASE_URL` as noted in `.env.example`.

FFmpeg must be on `PATH` for `pnpm --filter @contentforge/renderer render:demo`. Output is stored under `.local-storage`, which is gitignored.

## Full Docker Compose smoke test (T03)

The Compose stack builds the production images, waits for healthy PostgreSQL,
runs Prisma migrations once, then starts the web, worker, and renderer. All three
app containers expose readiness healthchecks. They share a named `/data` volume.

From the repository root, configure **development-only** secrets first:

```bash
cp .env.example .env
# Change AUTH_SECRET and ENCRYPTION_KEY in .env to distinct random 32-byte values.
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Expect `postgres`, `web`, `worker`, and `renderer` to become `healthy`;
`migrate` must exit with code 0. The following commands check readiness from
the host (ports are only bound to localhost):

```bash
curl --fail http://127.0.0.1:3000/api/readyz
curl --fail http://127.0.0.1:3001/readyz
curl --fail http://127.0.0.1:3002/readyz
docker compose logs --no-color migrate
```

Now **create a real MP4 inside the renderer container** and prove that the
web container sees the same media through the shared volume:

```bash
docker compose exec -T renderer pnpm --filter @contentforge/renderer render:demo
docker compose exec -T renderer ls -lh /data/demo/contentforge-demo.mp4
docker compose exec -T web ls -lh /data/demo/contentforge-demo.mp4
docker compose exec -T renderer test -s /data/demo/contentforge-demo.mp4
docker compose exec -T web test -s /data/demo/contentforge-demo.mp4
```

Clean up with `docker compose down` (preserves media/database named volumes);
use `docker compose down --volumes` only when you intentionally want to erase
local DB and generated media.

The `Compose stack smoke` GitHub Actions workflow repeats these checks on
relevant pull requests. A committed smoke-test procedure is **not** evidence
that an MP4 was generated until the workflow passes.
