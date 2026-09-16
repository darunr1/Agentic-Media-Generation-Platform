FROM node:22-bookworm-slim
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @contentforge/database db:generate && pnpm --filter @contentforge/worker build
ENV NODE_ENV=production
EXPOSE 3001
CMD ["pnpm","--filter","@contentforge/worker","start"]
