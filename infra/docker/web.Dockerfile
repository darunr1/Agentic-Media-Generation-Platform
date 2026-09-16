FROM node:22-bookworm-slim AS base
RUN corepack enable
WORKDIR /app
COPY . .
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV AUTH_SECRET=build-only-placeholder-secret-at-least-32-characters
ENV ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
RUN pnpm install --frozen-lockfile && pnpm --filter @contentforge/database db:generate && pnpm --filter @contentforge/web build
ENV DATABASE_URL="" AUTH_SECRET="" ENCRYPTION_KEY=""
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm","--filter","@contentforge/web","start"]
