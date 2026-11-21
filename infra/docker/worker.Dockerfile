FROM node:22-bookworm-slim
# Media handlers also use FFmpeg drawtext; bundled ffmpeg-static is not a
# substitute for system fonts and a drawtext-capable build.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @contentforge/database db:generate && pnpm --filter @contentforge/worker build
ENV NODE_ENV=production
ENV FFMPEG_PATH=/usr/bin/ffmpeg
EXPOSE 3001
CMD ["pnpm","--filter","@contentforge/worker","start"]
