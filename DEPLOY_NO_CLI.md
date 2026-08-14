# Deploying ALP without a command line

Everything below happens in a browser. No Supabase CLI, no Docker, no Node.

Do it in this order. Each step depends on the one before.

---

## 1. Wake the project

`ptsndeotblrgmxcfffrt.supabase.co` did not resolve in DNS when checked, which
is exactly what produces "Failed to fetch" on signup — the browser can't find
the server, so no request is made and nothing reaches your Supabase logs.

Open **supabase.com/dashboard** and find the project.

- Says **Paused** → Restore. A couple of minutes to come back.
- Looks healthy → the ref isn't the problem. Skip to the box at the bottom of
  this file before doing anything else.
- Not in the list → it was deleted, or it belongs to an organisation this
  account isn't in.

Confirm it is awake before continuing. Every later step fails confusingly
against a paused project.

---

## 2. Schema

**SQL Editor → New query.** Three files, in order, from
`supabase/migrations/`:

1. `20260813000001_initial_schema.sql`
2. `20260813000002_grants.sql`
3. `20260814000003_profiles_privilege_guard.sql`

Paste each, press **Run**. All three are idempotent, so re-running is safe.

The third file is not optional. Without it, any teacher can send one
request that rewrites their own `role` to `admin` and their own `org_id`
to another school, and then read that school's entire caseload. See
section 9 of `uat/UAT_PLAN.md`.

Then verify — paste this and check the output:

```sql
select tablename, rowsecurity from pg_tables
 where schemaname = 'public' order by tablename;
-- 12 tables, rowsecurity true on every single one

select string_agg(e::text, ', ') from unnest(enum_range(null::user_role)) e;
-- teacher, director, admin, intervention, related

select tgname from pg_trigger where tgname = 'on_auth_user_created';
-- one row
```

That trigger is why signup would still fail even with DNS fixed: without it
an account is created in auth with no matching `profiles` row, and the app
dead-ends on a blank dashboard.

---

## 3. Edge Functions

**Edge Functions → Deploy a new function → Via Editor.**

Two functions. Paste-ready single files are in
`supabase/functions/_dashboard/`:

| Name it exactly | Paste this file |
|---|---|
| `invite-user` | `_dashboard/invite-user.ts` |
| `ai-assist` | `_dashboard/ai-assist.ts` |

The names must match — the app calls them by name.

`invite-user.ts` has `authorize.ts` inlined, because the dashboard editor
takes one file at a time. It is the same logic: the 32 invitation-security
tests were run against the inlined copy as well as the split original, and
both pass identically.

**The repo stays the source of truth.** The dashboard editor has no
versioning and no rollback. Use it to deploy; make real changes in
`supabase/functions/invite-user/`, where `authorize.ts` is a separate,
unit-tested module, and regenerate the paste file from there.

---

## 4. Secrets

**Edge Functions → Secrets.** Three:

| Name | Where it comes from |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → `service_role` |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `ALLOWED_ORIGINS` | `https://growwithalp.com,https://www.growwithalp.com` |

The service role key bypasses RLS entirely. It belongs here and nowhere else
— never in Netlify, never in a `VITE_` variable.

---

## 5. Netlify

**Before anything else — check the billing banner.** Netlify blocks builds
on a team with an overdue payment. A push will sit there doing nothing and
the failure gives no hint that money is the cause.

**Confirm which repo the site builds from.** Site configuration → Build &
deploy → Continuous deployment. The linked repository and branch decide
what actually ships, regardless of which folder you edited locally. If it
points at a tree containing `05-backend/`, `06-database/schema.prisma`,
`Dockerfile` or `railway.json`, that is the pre-Supabase architecture and
pushing it undoes this whole package.

**Build settings** should be inherited from `netlify.toml` at the repo root:

```
Base directory:      02-webapp
Build command:       npm run build
Publish directory:   02-webapp/dist
```

If the dashboard shows something different, the root `netlify.toml` is not
being read — check it is at the repository root and not inside `02-webapp/`.
A copy inside the base directory that declares `base = "02-webapp"` is
self-referential and gets ignored, and the site silently builds from the
dashboard's settings instead.

**Site configuration → Environment variables:**

```
VITE_SUPABASE_URL       = https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY  = <Settings → API Keys → anon public>
```

Use the **anon / public** key. Never `service_role` — `VITE_*` values are
inlined into the JavaScript and readable by anyone who opens the bundle.

Set these **before** triggering a build. Vite bakes `VITE_*` values in at
build time, so a variable added after the last build changes nothing until
you deploy again. If the current site was built without them, that alone
explains the failure.

Then push the repo to GitHub and let Netlify build. Nothing to run locally.

---

## 6. Check it worked

1. Open growwithalp.com. The page title should now read **"Accelerated
   Learning Plan Platform for Schools"** — if it still says "Adaptive
   Learning Program Platform for Special Education", the old build is still
   being served and nothing else here will look right.
2. Open the signup page. **There should be no role dropdown.** If you can
   still pick "Administrator", the deploy did not take.
3. Sign up with a fresh email. It should succeed.
4. In Supabase → Table Editor → `profiles`, the new row should show
   `status = pending` and `org_id = null`.
5. Provision yourself as the first director — SQL Editor:

```sql
insert into public.orgs (name, country) values ('Your School','GH')
returning id;

update public.profiles
   set org_id = '<the id returned above>', role = 'director', status = 'active'
 where email = 'you@yourschool.edu' and org_id is null;
```

6. Reload the app. You should now have a working director account, and can
   invite everyone else from inside it.

---

> **If the project was healthy all along**
>
> Then the deployed bundle is pointing somewhere else. Open growwithalp.com,
> DevTools → Network, attempt a signup, and read the failed request's URL.
> That URL is what is actually compiled into the deployed JavaScript. If it
> shows a different project ref, or `undefined`, you have found the bug — fix
> the Netlify variable and redeploy.
