# Campaign Manager

A self-hosted web app for managing and executing outbound voice AI call campaigns. Built with Next.js 14, PostgreSQL, and Docker — designed to run alongside the [voice-asterisk-agent](https://github.com/Mainer-g00t/voice-asterisk-agent) stack on the same Docker network.

---

## Features

- **Campaign management** — create campaigns with a name, agent slug, VoIP base URL, and template variables
- **Contact import** — paste CSV or upload a file; extra columns automatically become template variables per contact
- **Campaign execution** — start/pause/resume a campaign; calls are originated one per second via the VoIP API
- **CDR webhook receiver** — receives call detail records from the VoIP platform and updates contact/call status in real time
- **Live dashboard** — progress bars, per-campaign stats, and auto-refreshing contact status (every 5s)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Docker network: voiceai             │
│                                                      │
│  ┌──────────────────┐      ┌───────────────────────┐ │
│  │  campaign-manager │─────▶│  config-api:8080      │ │
│  │  :3001            │      │  (originate calls)    │ │
│  │                   │◀─────│                       │ │
│  │  /api/cdr         │      │  (CDR webhook)        │ │
│  └──────────────────┘      └───────────────────────┘ │
│           │                                           │
│  ┌────────▼──────────┐                               │
│  │  postgres:5432     │                               │
│  │  db: campaign_     │                               │
│  │      manager       │                               │
│  └───────────────────┘                               │
└─────────────────────────────────────────────────────┘
```

The campaign manager joins the existing `voice-asterisk-agent_voiceai` Docker network so it can reach `config-api` by service name without exposing extra ports.

---

## Prerequisites

- Docker + Docker Compose
- The [voice-asterisk-agent](https://github.com/Mainer-g00t/voice-asterisk-agent) stack running (provides the `voiceai` network and `postgres` + `config-api` containers)

---

## Setup

### 1. Create the database

Run this once while the voice AI stack is up:

```bash
docker exec -it postgres psql -U voiceai -c "CREATE DATABASE campaign_manager;"
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your Postgres password:

```env
PORT=3001
APP_URL=http://campaign-manager:3001
DATABASE_URL=postgresql://voiceai:YOUR_POSTGRES_PASSWORD@postgres:5432/campaign_manager
VOIP_BASE_URL=http://config-api:8080
```

`APP_URL` is used as the `callback_url` sent to the VoIP platform so CDRs can be pushed back. If the campaign manager is exposed externally, set this to your public URL.

### 3. Start

```bash
docker-compose up --build
```

Open **http://localhost:3001**

---

## Usage

### Creating a campaign

1. Click **Create your first campaign** (or the **+ New Campaign** button)
2. Fill in:
   - **Campaign Name** — display label
   - **Agent Slug** — the voice agent identifier (e.g. `sales`, `support`). Must match a slug configured in the voice AI platform.
   - **VoIP Base URL** — defaults to `http://config-api:8080`. Change if your setup differs.
   - **Template Variables** — key/value pairs merged with contact data and passed to the agent (e.g. `product = Premium`, `company = Acme`)
3. Click **Create Campaign**

### Importing contacts

From the campaign detail page, click **Import Contacts**. Paste CSV or upload a file.

**CSV format:**

| phone | first_name | last_name | product | ... |
|-------|------------|-----------|---------|-----|
| +15551234567 | Luis | B | Premium | ... |

- `phone` is required (also accepts `Phone` or `PHONE`)
- `first_name` / `last_name` are optional (also accepts `First Name`, `firstname`, etc.)
- Any additional columns become per-contact `template_vars` that override campaign-level vars

### Running a campaign

From the campaign detail page:

- **Start** — begins originating calls (1 call/second). The campaign status changes to `active`.
- **Pause** — stops new calls from being initiated. Calls already in progress complete normally.
- **Resume** — continues from where it left off, calling remaining `pending` contacts.

### Contact statuses

| Status | Meaning |
|--------|---------|
| `pending` | Not yet called |
| `calling` | Call originated, waiting for CDR |
| `completed` | Call finished normally |
| `failed` | Could not originate the call |
| `do_not_call` | VoIP platform returned `do_not_call` end reason |

---

## API Reference

### `POST /api/cdr`

Receives call detail records from the VoIP platform when a call ends.

```json
{
  "call_uuid": "...",
  "agent_slug": "sales",
  "direction": "outbound",
  "destination": "+15551234567",
  "started_at": "...",
  "ended_at": "...",
  "duration_seconds": 87,
  "turn_count": 5,
  "end_reason": "hangup",
  "transcript": [...],
  "metadata": {
    "campaign_id": "...",
    "contact_id": "..."
  }
}
```

### `POST /api/campaigns`

Create a campaign.

```json
{
  "name": "Q4 Outreach",
  "agent_slug": "sales",
  "voip_base_url": "http://config-api:8080",
  "template_vars": { "product": "Premium" }
}
```

### `POST /api/campaigns/:id/execute`

Start campaign execution. Returns `202` immediately; calls run in the background.

### `POST /api/campaigns/:id/pause`

Pause the campaign.

### `POST /api/campaigns/:id/resume`

Resume a paused campaign.

### `GET /api/campaigns/:id/stats`

Returns contact counts by status.

```json
{
  "total": 100,
  "pending": 40,
  "calling": 5,
  "completed": 50,
  "failed": 3,
  "do_not_call": 2
}
```

### `POST /api/campaigns/:id/contacts/import`

Import contacts from CSV. Accepts `multipart/form-data` with a `file` or `csv` field, or JSON with `{ "csv": "..." }`.

---

## VoIP API Integration

When executing a campaign, each contact triggers a call via:

```
POST {voip_base_url}/api/outbound/originate
```

```json
{
  "destination": "+15551234567",
  "agent_slug": "sales",
  "callback_url": "http://campaign-manager:3001/api/cdr",
  "metadata": {
    "campaign_id": "...",
    "contact_id": "..."
  },
  "template_vars": {
    "name": "Luis",
    "product": "Premium"
  }
}
```

Template vars are merged in this order (later values win):
1. Campaign-level `template_vars`
2. `{ name: contact.first_name }` (if set)
3. Contact-level `extra_vars` (columns from CSV import)

---

## Database Schema

| Table | Description |
|-------|-------------|
| `campaigns` | Campaign config: name, agent_slug, template_vars, status |
| `contacts` | One row per contact per campaign: phone, name, status, call_uuid |
| `calls` | Full CDR data for each call attempt |

Tables are created automatically on first startup — no migration step required.

---

## Development

```bash
# Install dependencies
npm install

# Run locally (requires a running Postgres)
DATABASE_URL=postgresql://voiceai:password@localhost:5432/campaign_manager \
APP_URL=http://localhost:3001 \
npm run dev
```

---

## Tech Stack

- **Next.js 14** (App Router, server components + API routes)
- **PostgreSQL** via `pg` + `drizzle-orm`
- **Tailwind CSS**
- **Docker** (multi-stage Alpine build)
