FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @contentforge/renderer build
ENV NODE_ENV=production
EXPOSE 3002
CMD ["pnpm","--filter","@contentforge/renderer","start"]
