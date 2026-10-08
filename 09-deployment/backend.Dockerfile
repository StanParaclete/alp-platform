# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app/05-backend

FROM base AS dependencies
COPY 05-backend/package.json 05-backend/package-lock.json ./
RUN npm ci --ignore-scripts
COPY 05-backend/prisma ./prisma
COPY 05-backend/prisma.config.ts ./
RUN npm run generate && npm run validate

# Migrations use a separate image and database identity, never API startup.
FROM dependencies AS migrate
COPY 06-database/migrations /app/06-database/migrations
USER node
CMD ["npm", "run", "migrate:deploy"]

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev --ignore-scripts && npm cache clean --force

FROM base AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4100
COPY --from=production-dependencies /app/05-backend/node_modules ./node_modules
COPY 05-backend/package.json ./
COPY 05-backend/src ./src
COPY 05-backend/scripts/bootstrap.mjs ./scripts/bootstrap.mjs
USER node
EXPOSE 4100

FROM runtime AS worker
CMD ["node", "src/worker.mjs"]

FROM runtime AS api
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 CMD ["node", "--input-type=module", "-e", "const r=await fetch('http://127.0.0.1:'+process.env.PORT+'/health/ready',{signal:AbortSignal.timeout(4000)});process.exit(r.status===200&&(await r.json()).status==='ready'?0:1)"]
CMD ["node", "src/server.mjs"]
