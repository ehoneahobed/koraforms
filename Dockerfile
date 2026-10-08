# Base for the build stages: pnpm plus a C++ toolchain. better-sqlite3 downloads
# a prebuilt binary and compiles from source when the download fails (it timed
# out on the 2026-10-05 deploy); the slim image has no compiler for that. Only
# node_modules and dist leave these stages, so the runtime image stays slim.
FROM node:22-slim AS toolchain
WORKDIR /app
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*
# Pin pnpm 10.x to match the lockfile and package.json "packageManager"
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

# Stage 1: Build
FROM toolchain AS builder
# Install dependencies
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# Copy source and build frontend
COPY . .
RUN pnpm build

# Stage 2: Production dependencies only
FROM toolchain AS deps
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod

# Stage 3: Production
FROM node:22-slim
WORKDIR /app

# Copy built assets and server files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/src/domain ./src/domain
COPY --from=builder /app/src/types.ts ./src/types.ts
COPY --from=builder /app/src/schema.ts ./src/schema.ts
# Server imports shared helpers from src/utils (via types/domain). Keep this in
# sync with server.ts imports: missing files crash the container at boot.
COPY --from=builder /app/src/utils/formula.ts ./src/utils/formula.ts
COPY --from=builder /app/src/utils/plainText.ts ./src/utils/plainText.ts
COPY --from=builder /app/package.json ./

# Production dependencies, already built for this exact base image
COPY --from=deps /app/node_modules ./node_modules

# Create data directory for SQLite
RUN mkdir -p /data

ENV PORT=3001
ENV DB_PATH=/data/koraforms-server.db
ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "--import", "tsx", "server.ts"]
