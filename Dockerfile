# Stage 1: Build
FROM node:22-slim AS builder
WORKDIR /app

# Install pnpm (pin to 10.x to match lockfile version)
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

# Install dependencies
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# Copy source and build frontend
COPY . .
RUN pnpm build

# Stage 2: Production
FROM node:22-slim
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

# Copy built assets and server files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/src/domain ./src/domain
COPY --from=builder /app/src/types.ts ./src/types.ts
COPY --from=builder /app/src/utils/formula.ts ./src/utils/formula.ts
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/.npmrc ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Create data directory for SQLite
RUN mkdir -p /data

ENV PORT=3001
ENV DB_PATH=/data/koraforms-server.db
ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "--import", "tsx", "server.ts"]
