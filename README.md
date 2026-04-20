# 💰 Pricing Workflow

An automated pricing update request management system built with **Next.js 15**, **Tailwind CSS**, **MongoDB**, and **Google Gemini AI**.

## 🗺️ Workflow

```
User sends email
    ↓
Email received (webhook or simulated)
    ↓
Check mandatory fields (per template)
    ↓ missing?               ↓ all present?
Reply requesting info     Gemini AI summarizes email
    ↓                          ↓
User replies           Extract & map to pricing JSON
    ↓                          ↓
Re-check fields        Queue for manual approval
                               ↓ approved?
                        Call external Pricing API
                               ↓
                        Notify requester
```

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone <your-repo>
cd pricing-workflow
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string (Atlas or local) |
| `SMTP_HOST` | SMTP server (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | SMTP port (587 for TLS) |
| `SMTP_USER` | SMTP username / email address |
| `SMTP_PASS` | SMTP password or app password |
| `SMTP_FROM` | Display name + email for outbound emails |
| `PRICING_EMAIL` | Designated email that receives pricing requests |
| `GEMINI_API_KEY` | Google Gemini API key |
| `PRICING_API_URL` | Your external pricing API endpoint |
| `PRICING_API_KEY` | Bearer token for pricing API (optional) |
| `NEXT_PUBLIC_APP_URL` | Your app URL |

### 3. Seed Default Template

```bash
npx tsx scripts/seed.ts
```

### 4. Run Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📧 Email Integration

### Receiving Emails

The system exposes a webhook endpoint at:

```
POST /api/emails/inbound
```

Configure your email provider to forward incoming emails to this endpoint. Supported providers:

**SendGrid Inbound Parse**
- Set the webhook URL to `https://your-domain.com/api/emails/inbound`
- The payload fields `from`, `to`, `subject`, `text` are mapped automatically

**Mailgun**
- Use Forward route to `https://your-domain.com/api/emails/inbound`

**Postmark**
- Set inbound webhook to `https://your-domain.com/api/emails/inbound`

**Gmail / Custom IMAP**
- Use a service like [Zapier](https://zapier.com) or [Make](https://make.com) to listen for new emails and POST to the endpoint

### Expected Payload

```json
{
  "from": "John Smith <john@example.com>",
  "to": "testRates@domain.com",
  "subject": "Pricing Update Request",
  "text": "Product SKU: PROD-001\nNew Price: 129.99\n..."
}
```

---

## 🗂️ Project Structure

```
src/
├── app/
│   ├── (app)/                    # Authenticated app layout
│   │   ├── dashboard/            # Overview & stats
│   │   ├── queue/                # Approval queue list + detail
│   │   ├── templates/            # Template CRUD
│   │   └── simulate/             # Email simulation tool
│   ├── api/
│   │   ├── emails/
│   │   │   ├── inbound/          # Webhook: process incoming email
│   │   │   └── simulate/         # POST: test without real email
│   │   ├── templates/            # CRUD for pricing templates
│   │   ├── queue/                # Queue management + approve/reject
│   │   └── dashboard/            # Stats aggregation
│   └── globals.css
├── components/
│   ├── layout/Sidebar.tsx
│   └── ui/
│       ├── StatusBadge.tsx
│       └── Toast.tsx
├── lib/
│   ├── db.ts                     # Mongoose connection
│   ├── email.ts                  # Nodemailer + email templates
│   ├── gemini.ts                 # Google Gemini AI integration
│   ├── fieldExtractor.ts         # Mandatory field checker
│   ├── pricingApi.ts             # External pricing API caller
│   └── utils.ts                  # cn() helper
├── models/
│   ├── PricingTemplate.ts        # Template schema
│   └── PricingQueue.ts           # Queue item schema
├── types/
│   └── index.ts                  # TypeScript interfaces
└── scripts/
    └── seed.ts                   # DB seed script
```

---

## 🧠 AI Features

### Gemini Integration

The system uses **Google Gemini 1.5 Flash** for two tasks:

1. **Email Summarization** — Converts raw email body into a concise 2-3 sentence summary and extracts field values
2. **Pricing Payload Mapping** — Maps extracted data into a clean JSON payload matching the pricing template

Get a free API key at [Google AI Studio](https://aistudio.google.com/).

---

## 📊 Queue Statuses

| Status | Description |
|---|---|
| `pending_info` | Missing mandatory fields — awaiting requester reply |
| `pending_summary` | All fields present — Gemini processing in progress |
| `summarized` | AI summary complete |
| `mapped` | Data mapped to pricing template |
| `pending_approval` | Ready for manual review & approval |
| `approved` | Approved by reviewer |
| `rejected` | Rejected with optional reason |
| `price_updated` | Pricing API called successfully |
| `failed` | Pricing API call failed |

---

## 🔌 Extending the Pricing API

Edit `src/lib/pricingApi.ts` to integrate with your actual pricing system:

```typescript
export async function callPricingApi(mappedData: MappedPricingData): Promise<PricingApiResult> {
  const response = await fetch(process.env.PRICING_API_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.PRICING_API_KEY}`,
    },
    body: JSON.stringify(mappedData),
  })
  // ...
}
```

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **Database**: MongoDB + Mongoose
- **AI**: Google Gemini 1.5 Flash
- **Email**: Nodemailer (SMTP)
- **Language**: TypeScript

---

## 📝 License

MIT
