# Pricing Workflow — CLAUDE.md

Developer guide for AI-assisted development on this project.

---

## Stack

- **Framework**: Next.js 15 (App Router, TypeScript)
- **Database**: MongoDB + Mongoose
- **AI**: Google Gemini 2.5 Flash (`@google/generative-ai`)
- **Email**: Nodemailer (SMTP via Gmail App Password)
- **Styling**: Tailwind CSS + Radix UI primitives
- **Runtime**: Docker (frontend + MongoDB containers)

---

## Project Structure

```
src/
├── app/
│   ├── (app)/               # UI pages (client components)
│   │   ├── dashboard/       # Stats overview
│   │   ├── queue/           # Approval queue list + [id] detail
│   │   ├── products/        # Products pricing table
│   │   ├── templates/       # Template CRUD
│   │   └── simulate/        # Manual email simulation tool
│   └── api/
│       ├── emails/
│       │   ├── inbound/     # POST — main email processing pipeline
│       │   └── simulate/    # POST — forwards to inbound for local testing
│       ├── queue/           # GET list, GET/approve/reject/summarize by [id]
│       ├── templates/       # CRUD [id]
│       ├── products/        # GET products table
│       └── dashboard/       # GET aggregated stats
├── lib/
│   ├── db.ts                # Mongoose singleton connection
│   ├── email.ts             # Nodemailer + HTML email builders
│   ├── gemini.ts            # Gemini: summarize, map, intent detection
│   ├── fieldExtractor.ts    # Keyword-based mandatory field checker
│   ├── pricingApi.ts        # Upserts approved data into products collection
│   └── utils.ts             # cn() Tailwind helper
├── models/
│   ├── PricingTemplate.ts   # Template schema (fields, targetEmail)
│   ├── PricingQueue.ts      # Queue item schema (full email thread + status)
│   └── Product.ts           # Products table with price_history[]
├── components/
│   ├── layout/Sidebar.tsx
│   └── ui/                  # StatusBadge, Toast
└── types/index.ts           # Shared TypeScript interfaces
```

---

## Core Workflow

```
Email arrives at Gmail
    ↓
Apps Script polls every 1 min (subject starts with "Pricing Update Request")
    ↓
POST /api/emails/inbound
    ↓
Gemini detects intent: new_request | reply_missing_info | correction
    ↓
correction → cancel pending items → treat as new_request
    ↓
Check mandatory fields (keyword match via fieldExtractor.ts)
    ↓ missing                    ↓ complete
Reply email sent             Gemini summarizes + extracts data
requester replies                ↓
                             mapToPricingTemplate()
                                 ↓
                             status: pending_approval
                                 ↓ (manual approval in UI)
                             callPricingApi() → upsert products collection
                             price_history[] appended on every update
```

---

## Email Intent Detection

`detectEmailIntent()` in `src/lib/gemini.ts` classifies each inbound email:

| Intent | Behaviour |
|---|---|
| `new_request` | Create new queue item |
| `reply_missing_info` | Append to existing `pending_info` item, re-check fields |
| `correction` | Cancel all pending items from sender, create new queue item |

Key signals Gemini looks for: "wrong price", "mistake", "correction", "last update was not correct".

---

## Queue Statuses

```
pending_info → pending_summary → summarized → mapped → pending_approval
                                                              ↓
                                                    approved / rejected
                                                              ↓
                                                 price_updated / failed
```

---

## Data Models

### PricingTemplate
Fields: `name`, `description`, `targetEmail`, `active`, `mandatoryFields[]`, `optionalFields[]`
- `targetEmail` must match the `to` address of inbound emails (lowercase)
- Each field has: `key`, `label`, `type` (string/number/date/select), `required`, `options[]`

### PricingQueue
Key fields: `status`, `requesterEmail`, `emailThread[]`, `missingFields[]`, `extractedData`, `mappedData`, `apiCallResult`
- `emailThread[]` stores every email in a back-and-forth conversation
- Indexes on: `status + createdAt`, `requesterEmail`, `templateId`

### Product
Fields: `product_sku` (unique), `product_name`, `current_price`, `new_price`, `effective_date`, `reason`, `region`, `currency`, `notes`, `last_updated_by`, `last_queue_id`, `price_history[]`
- Upserted by `product_sku` on approval
- `new_price` becomes `current_price` after each update
- `price_history[]` tracks every price change with timestamp and queue reference

---

## Key Environment Variables

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Full connection string (uses `mongodb` hostname inside Docker) |
| `GEMINI_API_KEY` | Google AI Studio key — use `gemini-2.5-flash` model |
| `SMTP_USER` / `SMTP_PASS` | Gmail account + 16-char App Password (not regular password) |
| `SMTP_FROM` | Display name + email for outbound emails |
| `PRICING_EMAIL` | Email address the app receives pricing requests on |
| `NEXT_PUBLIC_APP_URL` | Set to `http://frontend:3041` in Docker for internal fetches |

---

## Running Locally

```bash
# Start everything
docker compose up --build -d

# Rebuild after code changes
docker compose down && docker compose build --no-cache && docker compose up -d

# Seed default template (run inside container)
docker compose exec frontend npx tsx scripts/seed.ts

# View logs
docker compose logs -f frontend

# MongoDB exposed at localhost:27020 for local seed/debug
MONGODB_URI="mongodb://admin:Test12345@localhost:27020/pricing-workflow?authSource=admin" npx tsx scripts/seed.ts
```

---

## Inbound Email Integration (Gmail + Apps Script)

A Google Apps Script runs on a 1-minute trigger, polling `ranjayflash@gmail.com` and POSTing to `/api/emails/inbound`.

- Filters: `subject:"Pricing Update Request" newer_than:7d`
- Tracks processed message IDs in `PropertiesService` to avoid duplicates
- Each individual message in a thread is forwarded separately
- Script file: managed in Google Apps Script editor (not in this repo)

---

## Adding a New Feature — Checklist

- [ ] New API route → `src/app/api/<name>/route.ts`
- [ ] New page → `src/app/(app)/<name>/page.tsx` + add to `Sidebar.tsx`
- [ ] New model → `src/models/<Name>.ts`, export `<Name>Model`
- [ ] New types → add to `src/types/index.ts`
- [ ] If new Gemini prompt → add to `src/lib/gemini.ts`
- [ ] Rebuild Docker after any `src/` changes

---

## Known Limitations / Future Work

- Field detection in `fieldExtractor.ts` is keyword-based — can produce false positives for loosely worded emails
- No authentication on the UI (anyone with the URL can approve/reject)
- `PRICING_API_URL` is a stub — currently writes directly to MongoDB products collection
- Apps Script URL must be updated manually when ngrok restarts (use a deployed URL to fix)
- Templates are not versioned — editing a template doesn't update existing queue items
