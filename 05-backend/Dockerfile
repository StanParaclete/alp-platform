# ─────────────────────────────────────────────────────────────────
# ALP Platform — Backend Dockerfile (Multi-stage)
# Built by Stan Paraclete | www.stanparaclete.com
# ─────────────────────────────────────────────────────────────────

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY ../06-database/schema.prisma ./prisma/schema.prisma
RUN npm ci --only=production
RUN npx prisma generate

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY ../06-database/schema.prisma ./prisma/schema.prisma

# Stage 3: Production runner
FROM node:20-alpine AS production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 alp
WORKDIR /app

# Copy only what's needed
COPY --from=deps --chown=alp:nodejs /app/node_modules ./node_modules
COPY --chown=alp:nodejs . .

# Health check dependencies
RUN apk add --no-cache curl

USER alp

EXPOSE 4000
ENV NODE_ENV=production PORT=4000

# Run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
