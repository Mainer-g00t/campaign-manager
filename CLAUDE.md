# Campaign Manager — Claude Context

## What this project is

A self-hosted outbound call campaign manager for the voice-asterisk-agent platform. Users create campaigns, import contacts (CSV), and the app originates calls via the VoIP API (`config-api`). When calls end, the VoIP platform pushes a CDR webhook back to `/api/cdr`.

## Stack

- **Next.js 14** App Router — both UI and API routes in one app
- **PostgreSQL** — uses the shared `postgres` container from voice-asterisk-agent (database: `campaign_manager`)
- **drizzle-orm** with `pg` driver — schema defined in `src/db/schema.ts`, auto-created on startup via raw SQL in `src/db/index.ts`
- **Tailwind CSS** — no component library, plain Tailwind only
- **Docker** — multi-stage Alpine build, joins `voice-asterisk-agent_voiceai` network as an external network

## Key design decisions

- **No drizzle migrations at runtime** — tables are created with `CREATE TABLE IF NOT EXISTS` raw SQL inside `src/db/index.ts` on module load. No `drizzle-kit push` or migration files needed.
- **`getDb()` pattern** — all routes call `const db = await getDb()` to ensure the schema init promise has resolved before any query runs. Never import `db` directly.
- **Background campaign loop** — `setImmediate(() => runCampaign(id))` defers after HTTP response. Acceptable for self-hosted; for scale, replace with BullMQ or similar.
- **Port 3001** — Grafana occupies 3000 in the voice AI stack.
- **`APP_URL`** — used as the `callback_url` sent to the VoIP API. Must be reachable from the `config-api` container, so defaults to `http://campaign-manager:3001`.

## Project structure

```
src/
  app/
    page.tsx                              # Dashboard (server component)
    layout.tsx
    campaigns/
      new/page.tsx                        # Create campaign form (client component)
      [id]/
        page.tsx                          # Campaign detail + contacts table
        import/page.tsx                   # CSV import UI
    api/
      cdr/route.ts                        # CDR webhook receiver
      campaigns/
        route.ts                          # POST /api/campaigns
        [id]/
          route.ts                        # GET /api/campaigns/:id
          execute/route.ts                # POST — start campaign
          pause/route.ts                  # POST — pause
          resume/route.ts                 # POST — resume
          stats/route.ts                  # GET — contact counts by status
          contacts/
            route.ts                      # GET contacts, POST single contact
            import/route.ts               # POST CSV import
  db/
    index.ts                              # Pool, schema init, getDb()
    schema.ts                             # drizzle pgTable definitions
  lib/
    campaign-runner.ts                    # Call loop: pending contacts → originate → update status
```

## Environment variables

| Variable | Default (docker-compose) | Description |
|----------|--------------------------|-------------|
| `PORT` | `3001` | HTTP port |
| `APP_URL` | `http://campaign-manager:3001` | Used as CDR callback_url |
| `DATABASE_URL` | `postgresql://voiceai:...@postgres:5432/campaign_manager` | Postgres connection |
| `VOIP_BASE_URL` | `http://config-api:8080` | Voice AI platform base URL |

## Docker / networking

The app joins `voice-asterisk-agent_voiceai` as an **external** network (defined in `docker-compose.yml`). This gives it access to:
- `postgres:5432` — shared database
- `config-api:8080` — VoIP origination API

The voice AI stack must be running before `docker-compose up` so the network exists.

## Template variable merge order

When originating a call, vars are merged as:
1. Campaign-level `template_vars` (lowest priority)
2. `{ name: contact.first_name }` if set
3. Contact `extra_vars` from CSV import (highest priority)

## Data flow

```
User clicks Start
  → POST /api/campaigns/:id/execute
  → setImmediate(runCampaign)
  → for each pending contact:
      POST config-api:8080/api/outbound/originate
      → contact.status = 'calling'
  → call ends on VoIP side
  → POST /api/cdr  (from config-api)
  → contact.status = 'completed' | 'failed' | 'do_not_call'
```
