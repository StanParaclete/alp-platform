FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy package files first (for Docker layer caching)
COPY package*.json ./

# ✅ KEY FIX: Install ALL deps (including devDeps like prisma CLI)
# Do NOT use --only=production here - prisma generate needs prisma CLI
RUN npm install

# Copy prisma schema and generate client
COPY prisma/ ./prisma/
RUN npx prisma generate

# Copy source code
COPY src/ ./src/

# Set ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 4000

ENV NODE_ENV=production

CMD ["dumb-init", "node", "src/index.js"]
