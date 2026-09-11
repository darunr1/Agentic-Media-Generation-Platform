FROM node:22-bookworm-slim AS base
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @contentforge/web build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm","--filter","@contentforge/web","start"]
