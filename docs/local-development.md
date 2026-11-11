# Local development (Docker PostgreSQL + pnpm services)

This is the recommended setup for a **fresh clone on a second machine**. Docker Compose runs **PostgreSQL only**; `pnpm dev` runs the **web, worker, and renderer** processes on the host. No paid API provider, SMTP account, or cloud project is needed for the mock demo.

## 1. Prerequisites

- Git, **Node.js 22+**, and **pnpm 9.15.0** (pinned by `packageManager` in the root `package.json`).
- Docker Desktop/Engine with the **Docker Compose v2** plugin, with Docker running. On Windows, use Docker Desktop with a working Linux-container backend.
- Available ports: **5432** for PostgreSQL and **3000** for the web app. The worker and renderer default to **3001** and **3002**.
- FFmpeg for rendering: the `@contentforge/media` package includes `ffmpeg-static` for supported platforms. If the bundled binary does not work, install FFmpeg and set `FFMPEG_PATH` in `.env` to the executable. The Docker images install FFmpeg and fonts.

From a terminal, confirm:

```bash
node --version
pnpm --version
docker compose version
docker info
```

If pnpm is missing, try `corepack enable` (where Corepack is available) or install the pinned version with `npm install -g pnpm@9.15.0`. Use the repository root for all remaining commands.

## 2. Clone and configure local-only secrets

```bash
git clone https://github.com/darunr1/Agentic-Media-Generation-Platform.git
cd Agentic-Media-Generation-Platform
cp .env.example .env
```

In **Windows PowerShell**, use `Copy-Item .env.example .env` instead of `cp` if necessary. Run this command to generate **two distinct random values**:

```bash
node -e "const c=require('node:crypto'); console.log('AUTH_SECRET='+c.randomBytes(32).toString('base64')); console.log('ENCRYPTION_KEY='+c.randomBytes(32).toString('base64'))"
```

In `.env`, **replace** the existing `AUTH_SECRET` and `ENCRYPTION_KEY` placeholder lines with the generated lines. `AUTH_SECRET` must be at least 32 characters; `ENCRYPTION_KEY` must decode to exactly 32 bytes. **Do not commit `.env` or paste the generated values into an issue or PR.**

Keep these values from `.env.example` for the Docker-hosted local demo:

```dotenv
DATABASE_URL=postgresql://contentforge:contentforge@localhost:5432/contentforge_dev?schema=public
QUEUE_PROVIDER=postgres
STORAGE_PROVIDER=local
LOCAL_STORAGE_DIR=.local-storage
EMAIL_PROVIDER=console
AI_TEXT_PROVIDER=mock
AI_IMAGE_PROVIDER=mock
AI_VIDEO_PROVIDER=mock
AI_TTS_PROVIDER=mock
AI_TRANSCRIPTION_PROVIDER=mock
SOCIAL_MOCK=true
```

The username/password above are **development-only Compose defaults**, not production credentials. Leave real OpenAI, Gemini, ElevenLabs, Resend, Stripe, and social provider keys unset when running mocks. Selecting a real provider requires its credentials and applicable model configuration; see [provider setup](../PROVIDERS.md) and [the environment template](../.env.example).

## 3. Install, start PostgreSQL, migrate, seed, and run

Run the following **in order**, from the repository root:

```bash
pnpm install --frozen-lockfile
docker compose up -d postgres
docker compose ps postgres
pnpm db:migrate
pnpm db:generate
pnpm db:seed
pnpm dev
```

Wait until `docker compose ps postgres` shows PostgreSQL **healthy** before migrating; the health check uses `pg_isready`. The root `db:migrate` script runs Prisma's `migrate deploy`; `db:generate` explicitly creates Prisma Client before `db:seed` imports `@prisma/client`, and `db:seed` loads demo fixtures. This extra generation step is required for a reliable fresh clone: in GitHub CI, `@prisma/client`'s install hook warned it could not find the Prisma schema in its default locations. Do not rely on implicit postinstall generation.

Keep the `pnpm dev` terminal open. It runs the Next.js web app, PostgreSQL queue worker, and FFmpeg renderer via Turbo. Open **http://localhost:3000**, sign in using **demo@contentforge.dev**, and find the email magic link printed by the **console email provider** in the terminal. Open the seeded **Riverbend Coffee Roasters** workspace and follow the [demo walkthrough](demo-script.md).

The seeded demo sign-in is **development-only**. The full production-container configuration does not provide that development login.

## 4. View worker, renderer, and database logs

With the recommended `pnpm dev` mode, the worker and renderer are **host processes**, not Docker containers. Read their output in the same terminal, with Turbo's package labels (`@contentforge/worker`, `@contentforge/renderer`). To isolate logs, stop `pnpm dev` first and use **separate terminals**:

```bash
pnpm --filter @contentforge/web dev
pnpm --filter @contentforge/worker dev
pnpm --filter @contentforge/renderer dev
```

Each command stays running. Do **not** start these alongside `pnpm dev`, or processes may compete for ports or queue work.

For the PostgreSQL container:

```bash
docker compose logs -f --tail=100 postgres
```

If using the **full container stack** instead of host `pnpm dev`, use:

```bash
docker compose logs -f --tail=100 worker renderer
docker compose ps
```

`docker compose up -d postgres` alone does **not** create worker or renderer containers. The commands above only show those container logs after those services are started.

## 5. Optional: run the full container stack

Do this **instead of** `pnpm dev` (stop host processes first). The renderer image includes the database CLI and shares the media volume with other app containers:

```bash
docker compose build web worker renderer
docker compose up -d postgres
docker compose run --rm renderer pnpm --filter @contentforge/database db:migrate
docker compose run --rm renderer pnpm --filter @contentforge/database db:seed
docker compose up -d web worker renderer
docker compose logs -f --tail=100 worker renderer
```

This mirrors the repository's [Docker setup notes](../README.md). Containers use `postgres:5432` as the database host (Compose overrides `DATABASE_URL`), whereas host-side `pnpm` commands use `localhost:5432`. The shared Docker media volume allows seed-generated files to be read by the worker and renderer. Do not expect the development-only demo login in production-mode containers.

For an optional database UI, run `docker compose up -d adminer` and open **http://localhost:8080**; use server `postgres` and the Compose development credentials.

## 6. Troubleshooting and safe cleanup

- **Cannot connect to Docker:** Start Docker Desktop/Engine; verify `docker info` and `docker compose version`.
- **PostgreSQL unhealthy or migration connection refused:** Run `docker compose ps postgres` and `docker compose logs postgres`; wait for health. From the host, `DATABASE_URL` must use `localhost:5432`, not `postgres:5432`.
- **Port 5432 or 3000 occupied:** Stop the conflicting process or change the Compose port mapping **and matching host `DATABASE_URL`**. Do not run the full Compose app stack and host `pnpm dev` simultaneously.
- **Invalid environment configuration:** Replace both local secret placeholders and inspect `packages/shared/src/env.ts` for validation rules.
- **Prisma Client missing:** Run `pnpm db:generate` and retry. GitHub's fresh-install CI log confirmed that the `@prisma/client` postinstall hook did not find this workspace's schema automatically.
- **Queued jobs or stalled renders:** Confirm **both** worker and renderer run; inspect their logs, `QUEUE_PROVIDER=postgres`, `DATABASE_URL`, and shared `LOCAL_STORAGE_DIR`.
- **FFmpeg unavailable:** Check the bundled `ffmpeg-static` executable; install FFmpeg and set `FFMPEG_PATH` if needed.

Use `Ctrl+C` to stop host development processes and `docker compose stop postgres` to stop the database without deleting its data. **Do not use `docker compose down -v` unless intentionally deleting local Docker volumes**. Local media is in gitignored `.local-storage/`.

**No-Docker fallback:** run `pnpm --filter @contentforge/database dev:db` in its own terminal, keep it running, and replace `DATABASE_URL` in `.env` with the exact address it prints (normally port **55432**). Then run migrations, seed, and `pnpm dev` in another terminal.

## 7. Verification status

- **Source-checked:** the exact `pnpm` scripts exist in the root and database `package.json` files; the `postgres` service and health check exist in `docker-compose.yml`; the web/worker/renderer `dev` scripts exist; `.env.example` documents the local defaults.
- **CI coverage:** `.github/workflows/ci.yml` runs `pnpm install --frozen-lockfile`, migrations against a PostgreSQL service, and `docker compose config --quiet`; it also builds all three Docker images. CI is **not** a verification of this exact host-side Docker Compose startup sequence.
- **Observed CI installation warning:** The `@prisma/client` postinstall step reported it could not locate the Prisma schema at a default path. The prescribed `pnpm db:generate` step addresses this as a deterministic prerequisite; it has not been validated on a second machine.
- **Not executed for this documentation change:** a fresh-clone/second-machine smoke test of the commands in section 3 and the optional full Compose stack. The available authoring environment has neither Docker nor pnpm and cannot pull the repository, so there is **no claim of a successful end-to-end local run**. No runtime failures were observed because the startup sequence could not be attempted.
- **Remaining acceptance check:** on a second machine, run section 3 verbatim, confirm `http://localhost:3000` and seeded demo sign-in, process one mocked generation job, and confirm both worker and renderer output. Record any actual machine-specific errors in this document before marking T02 complete.
