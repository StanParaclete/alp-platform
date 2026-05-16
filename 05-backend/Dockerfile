FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci --only=production
RUN npx prisma generate

FROM node:20-alpine AS production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 alp
WORKDIR /app
COPY --from=deps --chown=alp:nodejs /app/node_modules ./node_modules
COPY --chown=alp:nodejs . .
RUN apk add --no-cache curl
USER alp
EXPOSE 4000
CMD ["node", "src/index.js"]
