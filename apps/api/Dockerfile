# ─── Stage 1: Dependencies ───────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN npm ci --ignore-scripts

# ─── Stage 2: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx turbo build --filter=@therapulse/api

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# ─── Stage 3: Runtime ────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Non-root user for security
RUN addgroup --system --gid 1001 therapulse && \
    adduser --system --uid 1001 api

# Copy only production artifacts
COPY --from=builder --chown=api:therapulse /app/apps/api/dist ./dist
COPY --from=builder --chown=api:therapulse /app/apps/api/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=api:therapulse /app/node_modules ./node_modules
COPY --from=builder --chown=api:therapulse /app/apps/api/prisma ./prisma

USER api

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "dist/main.js"]
