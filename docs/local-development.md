# Local development

1. Copy `.env.example` to `.env`; replace the two local-only secret placeholders with random values.
2. Run `pnpm install` and `docker compose up -d postgres`.
3. Run `pnpm db:migrate && pnpm db:seed && pnpm dev`.
4. Sign in with `demo@contentforge.dev`; the console email provider prints the magic link.

No Docker fallback: `pnpm --filter @contentforge/database dev:db` starts embedded PostgreSQL on port 55432; update `DATABASE_URL` as noted in `.env.example`.

FFmpeg must be on `PATH` for `pnpm --filter @contentforge/renderer render:demo`. Output is stored under `.local-storage`, which is gitignored. Use `docker compose up --build` for full production-image parity.
