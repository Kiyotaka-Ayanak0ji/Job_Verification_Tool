# TrustHire — Verify any job before you apply

Self-hostable MERN + Python monorepo. Three services, one API surface:

```
frontend/              React 19 + Vite 5 + Redux Toolkit + React Router 7
backend/               Node 20 + Express 4 + MongoDB (Mongoose) + Redis 7
backend/ml-service/    Python 3.11 + Flask (trust-score model, ~140 features)
```

The frontend talks **only** to the Express backend. Express is the sole
gateway: it proxies scoring calls to Flask, calls Firecrawl for enrichment,
enforces RBAC + quotas, and single-flights concurrent verifications through
Redis Pub/Sub.

---

## Quick start (local)

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20 LTS+ |
| Python | 3.11+ |
| MongoDB | 7+ (or Docker) |
| Redis | 7+ (or Docker) |

### 1. Infrastructure (Mongo + Redis via Docker)

```bash
cd backend
docker compose up -d mongo redis
```

### 2. Python ML service — port 8001

```bash
cd backend/ml-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                 # optional: set FIRECRAWL_API_KEY
python scripts/train_seed.py         # trains + promotes the initial model
python app.py                        # http://localhost:8001
```

Health check: `curl http://localhost:8001/health`

### 3. Express backend — port 8000

```bash
cd backend
cp .env.example .env                 # edit MONGO_URI, JWT_* secrets, FLASK_URL, etc.
npm install
npm run migrate:up                   # creates indexes + bootstraps admin
npm run dev                          # http://localhost:8000
```

On first boot it seeds an admin account from `ADMIN_BOOTSTRAP_EMAIL` /
`ADMIN_BOOTSTRAP_PASSWORD` in `.env`. **Change the password after first login.**

Health check: `curl http://localhost:8000/api/health`
→ returns `{ ok: true, ml: { ok: true, model: "vX.Y.Z" } }` when Flask is reachable.

### 4. React frontend — port 5173

```bash
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

No `.env` needed for local dev — `vite.config.js` proxies `/api/*` to
`http://localhost:8000` automatically (override with `VITE_PROXY_TARGET`).

When deploying the frontend on a different origin than the API, set `VITE_API_URL`
at build time:
```bash
VITE_API_URL=https://api.example.com/api npm run build
```

### Full-stack via Docker

```bash
cd backend
cp .env.example .env      # fill in values
docker compose up --build  # mongo + redis + Express API + Flask ML service
```

The frontend is not containerised — run `npm run dev` or build it and serve
`frontend/dist` from any static host.

---

## Hosting online

| Piece | Suggested host | Notes |
|---|---|---|
| MongoDB | MongoDB Atlas (free M0 for staging) | Put the SRV URI in `MONGO_URI`. |
| Redis | Upstash / Redis Cloud | Put the TLS URL in `REDIS_URL`. |
| Express backend | Render / Railway / Fly.io | Deploy `backend/`. Set every var from `.env.example`. Run `npm run migrate:up` as a release step. |
| Flask ML service | Railway (Nixpacks) / Render | Deploy `backend/ml-service/`. `Procfile` runs the seed + `gunicorn`. |
| Frontend | Vercel / Netlify / Cloudflare Pages | `cd frontend && npm run build`, publish `frontend/dist`. |

### Wiring them together

```bash
# On the Express backend
FLASK_URL=https://<ml-service-host>
ML_SERVICE_API_KEY=<shared-secret>
CORS_ORIGIN=https://yourdomain.com,https://staging.yourdomain.com

# On the Flask ML service
ML_SERVICE_API_KEY=<same-shared-secret>
FIRECRAWL_API_KEY=<your-firecrawl-key>

# At frontend build time
VITE_API_URL=https://api.yourdomain.com/api
```

---

## Architecture

```
Browser
  │  axios + JWT bearer
  ▼
Express (backend/) ── JWT / RBAC / Rate-limit ──► Redis (coalescer + cache)
  │                                                    ▲
  │ axios + x-api-key                                  │
  ▼                                                    │
Flask ML service (backend/ml-service/)          Verification coalescer
  │  Firecrawl enrichment                       single-flights identical
  │  8 sub-scorers                              verify calls, caches 6h
  └─► Trust score + band
```

- **Frontend** (`frontend/`) — single axios client (`src/api/client.js`) with
  a JWT bearer + automatic refresh interceptor. Redux Toolkit slices per
  domain (`auth`, `reports`, `groups`, `usage`, `billing`, `mlAdmin`). RBAC
  is enforced both server-side and client-side via `<RequireAuth role="admin">`.
- **Backend** (`backend/`) — Express gateway. Key modules: `controllers/`,
  `routes/`, `services/verificationCoalescer.js` (Redis single-flight, 6h
  cache), `services/mlClient.js` (Flask proxy), `jobs/retrainCron.js`
  (nightly retrain).
- **ML service** (`backend/ml-service/`) — Flask app. Resolves user input
  (URL or company name) via Firecrawl, enriches with ~85 Normal or ~140 Deep
  Think features across 10 feature groups (A–J), runs 8 sub-scorers, and
  returns a trust score + band + per-parameter breakdown.

---

## Payments (Stripe + Razorpay)

Both providers are optional. Enable one or both by filling the matching keys
in `backend/.env` (see `backend/.env.example`). The Profile page auto-hides
any button whose provider is not configured.

### Stripe

1. Create two recurring prices (monthly + yearly) in the Stripe dashboard.
2. Fill `backend/.env`:
   - `STRIPE_SECRET_KEY=sk_test_...`
   - `STRIPE_PRICE_MONTHLY=price_...`
   - `STRIPE_PRICE_YEARLY=price_...`
   - `STRIPE_WEBHOOK_SECRET=whsec_...`
3. Add a webhook endpoint → `https://<api-host>/api/webhooks/stripe`.
   Subscribe to `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`.
4. Local dev: `stripe listen --forward-to localhost:8000/api/webhooks/stripe`

### Razorpay

1. Create two subscription plans (monthly + yearly) in Razorpay.
2. Fill `backend/.env`:
   - `RAZORPAY_KEY_ID=rzp_test_...`
   - `RAZORPAY_KEY_SECRET=...`
   - `RAZORPAY_PLAN_MONTHLY=plan_...`
   - `RAZORPAY_PLAN_YEARLY=plan_...`
   - `RAZORPAY_WEBHOOK_SECRET=...`
3. Add a webhook endpoint → `https://<api-host>/api/webhooks/razorpay`.
   Subscribe to `subscription.activated`, `subscription.charged`,
   `subscription.updated`, `subscription.cancelled`, `subscription.completed`.

`BILLING_SUCCESS_URL` / `BILLING_CANCEL_URL` should point at the frontend —
the Profile page detects the `session_id` / `provider` query params on return
and refreshes the plan automatically.

---

## Enrichment pipeline

The Flask service resolves an input string (URL or company name), calls
Firecrawl for open-web enrichment, and feeds a normalised payload through the
scoring pipeline.

1. Create a Firecrawl account and grab an API key.
2. Set `FIRECRAWL_API_KEY` in **both** `backend/.env` and
   `backend/ml-service/.env`. Without a key the enrichment degrades to an
   offline stub — the app returns a report with `"source": "none"` instead of
   failing.
3. Restart both services.

Deep Think mode layers additional enrichment: duplicate-posting detection,
social-media cross-platform identity checks, complaint severity scoring,
recruiter identity consistency, and sentence-embedding similarity. See
[`MODEL_FEATURES.md`](./MODEL_FEATURES.md) for the full list.

---

## Feedback → retrain loop

- Every verification detail page has a thumbs-up / thumbs-down feedback block.
  Submissions are stored in the `Feedback` collection.
- A cron job (`RETRAIN_CRON`, default `0 3 * * *`) posts accumulated feedback
  to `POST /retrain` on the Flask service when at least `RETRAIN_MIN_FEEDBACK`
  new rows exist. Set `DISABLE_CRON=1` to opt out.
- Admins can also trigger a retrain manually from `/admin/analytics`.

---

## Quotas (free vs pro)

| Feature | Free | Pro |
|---|---|---|
| Verifications / month | 10 | 50 |
| Deep Think runs / month | 1 | 10 |
| PDF exports / month | 2 | 10 |

Override defaults via `FREE_*` / `PRO_*` env vars in `backend/.env`.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot find package 'vite-plugin-pwa'` | `cd frontend && npm install` |
| Score chip blank | Old report with legacy band label. Delete + re-run. Frontend expects `high / likely / caution / risk`. |
| `enrichment_timeout` / `resolve_failed` | Firecrawl unreachable or input unresolvable. Check `FIRECRAWL_API_KEY` on the Flask service. Offline fallback is automatic. |
| `stripe_not_configured` / `razorpay_not_configured` | Provider env vars missing in `backend/.env`. Fill and restart. |
| Webhook returns `invalid_signature` | Webhook routes must be registered **before** `express.json()` — see `backend/src/index.js`. |
| `Cannot access 'auth' before initialization` | Circular import in Redux store. Import order in `frontend/src/store/index.js` must be `configureStore` first, then `setupApiInterceptors(store)`. |
| Admin Analytics pie chart empty | No verifications yet. Run at least one verification from a signed-in account. |
| Ports collide | Override `PORT` (backend), `FLASK_URL` / Flask `PORT` (ML service), `VITE_PROXY_TARGET` (frontend dev). |
| Deep Think results identical to Normal | Firecrawl key missing — enrichment falls back to stubs; `deep_think.enrich()` still runs but uses defaults. |
| `ml_service_unavailable` | Flask service not running or `FLASK_URL` wrong. Start `python app.py` and verify `curl $FLASK_URL/health`. |

---

## API surface (summary)

Full definitions live in `backend/src/routes/`. Key endpoints:

| Method | Path | Auth |
|---|---|---|
| POST | /api/auth/signup | — |
| POST | /api/auth/login | — |
| POST | /api/auth/refresh | — |
| GET | /api/auth/me | user |
| PATCH | /api/auth/profile | user |
| POST | /api/auth/change-password | user |
| POST | /api/verify/company | user |
| GET | /api/reports | user |
| GET | /api/reports/:id | user |
| PATCH | /api/reports/:id | user |
| DELETE | /api/reports/:id | user |
| POST | /api/reports/:id/pdf-export | user |
| GET | /api/groups | user |
| POST | /api/groups | user |
| PATCH | /api/groups/:id | user |
| DELETE | /api/groups/:id | user |
| GET | /api/usage/me | user |
| POST | /api/feedback | user |
| GET | /api/billing/status | user |
| POST | /api/billing/checkout | user |
| POST | /api/billing/portal | user |
| POST | /api/webhooks/stripe | — |
| POST | /api/webhooks/razorpay | — |
| GET | /api/admin/users | admin |
| PATCH | /api/admin/users/:id | admin |
| DELETE | /api/admin/users/:id | admin |
| GET | /api/admin/analytics | admin |
| GET | /api/admin/feedback | admin |
| GET | /api/admin/ml/settings | admin |
| PUT | /api/admin/ml/settings | admin |
| POST | /api/admin/ml/retrain | admin |
| GET | /api/admin/ml/runs | admin |
| GET | /api/admin/ml/bulk | admin |
| POST | /api/admin/ml/bulk | admin |
| GET | /api/admin/ml/notifications | admin |
| POST | /api/admin/ml/notifications/read | admin |
| PATCH | /api/admin/ml/feedback/:id/include | admin |
| GET | /api/models | user |
| GET | /api/health | — |

---

*See [`backend/README.md`](./backend/README.md) and
[`backend/ml-service/README.md`](./backend/ml-service/README.md) for
service-specific documentation.*
