# ALP No-Monthly-Fee Staging Stack

This path avoids the Railway monthly minimum while still deploying the real ALP
API. It is suitable for staging, owner review and first smoke testing. Do not
use it as the final school production stack without accepting the free-tier
limits.

## Target Stack

- API runtime: Render Free Web Service, service name `alp-api`
- PostgreSQL: Render Free Postgres, service name `alp-postgres`
- Redis-compatible cache: Render Free Key Value, service name `alp-redis`
- Website and browser app: existing Netlify staging projects

## Why This Is Staging, Not Final Production

Free services usually sleep, pause, cap storage, cap throughput or remove
production support. Render's free web service can spin down after inactivity and
may take 50 seconds or more to wake. The current free Postgres database expires
on November 8, 2026 unless upgraded or migrated before then. Render's free Key
Value service has no persistence and is only suitable for cache/session-like
data that can be rebuilt.

This stack is good for owner review, integration smoke testing and a no-monthly
cost launch rehearsal. ALP handles school and learner records, so final school
production still needs an always-on host, backups, monitoring, restore testing
and a clear support route.

## API Deployment Shape

Render deploys the API from the public GitHub repository:

- Repository: `https://github.com/StanParaclete/alp-platform`
- Branch: `codex/alp-ecosystem`
- Runtime: Node
- Plan: Free
- Build command:

```bash
cd 05-backend && npm ci --include=dev && npm run migrate:deploy
```

- Start command:

```bash
cd 05-backend && npm start
```

The build command generates Prisma Client and runs Prisma migrations before the
service starts. Only expose or point DNS to the service after both health checks
and the API checker pass.

## Verification

Use the Render service URL first:

```bash
curl -i https://<render-api-host>/health/live
curl -i https://<render-api-host>/health/ready
```

```bash
node 09-deployment/check-api.mjs \
  --api https://<render-api-host> \
  --origin https://app.growwithalp.com
```

Only after the checker passes should `api.growwithalp.com` point to the approved
API host.

## Secrets

Do not paste secrets into chat or commit them. Put these only into the provider
secret manager or local shell variables while deploying:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `CONTACT_WEBHOOK_TOKEN`
- Optional SMTP and password-recovery values

## Provider Setup Checklist

1. Create or sign into Render.
2. Create the free Postgres service `alp-postgres`.
3. Create the free Key Value service `alp-redis`.
4. Create the free Web Service `alp-api` from the GitHub repository.
5. Store connection strings and app secrets as Render environment variables.
6. Deploy the API and confirm migrations complete.
7. Wait for `/health/live` and `/health/ready` to pass.
8. Run `09-deployment/check-api.mjs` against the Render service URL.
9. Set Netlify DNS for `api.growwithalp.com` only after the API checker passes.
