# Stage 1: Build
FROM node:20-slim AS builder
WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build frontend
COPY . .
RUN pnpm build

# Stage 2: Production
FROM node:20-slim
WORKDIR /app

RUN corepack enable

# Copy built assets and server files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/sqlite-user-store.ts ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Create data directory for SQLite
RUN mkdir -p /data

ENV PORT=3001
ENV DB_PATH=/data/koraforms-server.db
ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "--import", "tsx", "server.ts"]
