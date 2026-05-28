# Railway Deployment Guide

## Phase 1: First Deployment

### Step 1: Prep your code

Make sure your auth is complete and committed — anyone with your public URL can approve pricing changes otherwise.

Then push everything to GitHub:
```bash
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

---

### Step 2: Create a Railway account and project

1. Go to **railway.app** → sign up with GitHub
2. Click **New Project**
3. Select **Deploy from GitHub repo** → authorize Railway → pick your repo

Railway will detect your `Dockerfile` automatically.

---

### Step 3: Add MongoDB

Inside your Railway project:

1. Click **+ Add Service** → **Database** → **MongoDB**
2. Once it provisions, click the MongoDB service → **Variables** tab
3. You'll see `MONGO_URL` — Railway generates this. It looks like:
   ```
   mongodb://mongo:XXXXXXXX@mongodb.railway.internal:27017
   ```
   Keep this tab open — you'll reference it in Step 5.

---

### Step 4: Configure the Frontend service

1. Click your frontend service → **Settings** tab
2. Under **Build**, confirm it uses `Dockerfile` (it should auto-detect)
3. Click **Variables** tab → add these one by one:

```
MONGODB_URI          = (paste the MONGO_URL from Step 3, then append: /pricing-workflow?authSource=admin)
GEMINI_API_KEY       = your-gemini-key
SMTP_HOST            = smtp.gmail.com
SMTP_PORT            = 587
SMTP_SECURE          = false
SMTP_USER            = your-gmail@gmail.com
SMTP_PASS            = your-16-char-app-password
SMTP_FROM            = Pricing Workflow <your-gmail@gmail.com>
PRICING_EMAIL        = the email address that receives pricing requests
NEXTAUTH_SECRET      = (generate once: openssl rand -base64 32)
GOOGLE_CLIENT_ID     = your-google-client-id
GOOGLE_CLIENT_SECRET = your-google-client-secret
```

Two variables you'll fill in **after** Railway assigns your public URL (Step 6):
```
NEXTAUTH_URL         = https://your-app.up.railway.app
NEXT_PUBLIC_APP_URL  = https://your-app.up.railway.app
```

---

### Step 5: Add the Gmail Poller as a second service

Your poller is a separate long-running container — it needs its own service.

1. **+ Add Service** → **GitHub Repo** → same repo
2. Click the new service → **Settings** → under **Build**, change **Dockerfile Path** to `Dockerfile.poller`
3. Under **Volumes**, add a persistent volume:
   - Mount path: `/data`
   - This stores the processed-email IDs so the poller doesn't reprocess on restart
4. Click **Variables** → add:

```
GMAIL_CLIENT_ID      = your-gmail-oauth-client-id
GMAIL_CLIENT_SECRET  = your-gmail-oauth-client-secret
GMAIL_REFRESH_TOKEN  = your-refresh-token
SMTP_USER            = your-gmail@gmail.com
NEXT_PUBLIC_APP_URL  = https://your-app.up.railway.app
```

> The poller calls `NEXT_PUBLIC_APP_URL/api/emails/inbound` — use the **public** Railway URL here, not a Docker-internal hostname.

---

### Step 6: Get your public URL and finalize

1. Click your frontend service → **Settings** → **Networking** → **Generate Domain**
2. Railway gives you: `https://pricing-workflow-xxxx.up.railway.app`
3. Go back and fill in `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` with this URL on the frontend service
4. Update `NEXT_PUBLIC_APP_URL` on the poller service too

**Update Google OAuth redirect URI:**

Go to Google Cloud Console → Credentials → your OAuth 2.0 Client → add to **Authorized redirect URIs**:
```
https://your-app.up.railway.app/api/auth/callback/google
```

---

### Step 7: Deploy and verify

Railway triggers a build automatically when you save variables. Watch the build logs:

1. Frontend service → **Deployments** tab → click the latest build → watch logs
2. Once it goes green, open your Railway URL in a browser
3. Check the poller service logs — you should see it polling Gmail every minute

---

## Phase 2: Ongoing Changes

### Deploying a code change

Railway auto-deploys on every push to `main`:

```bash
# Make your changes locally, then:
git add src/...
git commit -m "Your change description"
git push origin main
# Railway detects the push → rebuilds → zero-downtime redeploy
```

No manual steps needed. Railway builds the new Docker image, waits for it to be healthy, then swaps traffic.

---

### Adding/changing environment variables

1. Railway dashboard → your service → **Variables** tab
2. Add or edit the variable
3. Railway automatically **restarts** the service with the new value — no redeploy needed

---

### Viewing logs in production

```bash
# Install Railway CLI once:
npm install -g @railway/cli
railway login

# Stream live logs for the frontend:
railway logs --service frontend

# Stream poller logs:
railway logs --service gmail-poller
```

Or use the Railway dashboard → service → **Logs** tab.

---

### Running the seed script against production

```bash
# Get the production MongoDB URL from Railway dashboard, then:
MONGODB_URI="mongodb://mongo:PASSWORD@HOST:PORT/pricing-workflow?authSource=admin" \
  npx tsx scripts/seed.ts
```

---

## Quick Reference: What triggers a new build

| Action | What Railway does |
|---|---|
| `git push origin main` | Full rebuild + redeploy |
| Change an env variable | Restart only (no rebuild) |
| Change Dockerfile | Full rebuild on next push |
| Add a volume | Restart only |

---

## Before going live checklist

- [ ] Auth (login page + middleware) is complete and tested
- [ ] `NEXTAUTH_SECRET` is set to a strong random value (not the placeholder)
- [ ] Google OAuth redirect URI updated in Google Cloud Console
- [ ] Poller volume is mounted at `/data` so processed-ID state survives restarts
- [ ] `MONGODB_URI` points to the Railway internal MongoDB URL, not localhost
