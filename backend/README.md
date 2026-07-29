# TrustHire — Backend (Express gateway)

## Deployed Link
- (Link)[www.google.com]
---

Self-hostable Node/Express API. The sole gateway the React frontend communicates
with; it fronts MongoDB, Redis, and the Flask ML service in `./ml-service`.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node 20, ESM modules |
| Framework | Express 4 |
| Database | MongoDB 7 + Mongoose 8 |
| Cache / coalescer | Redis 7 + ioredis |
| Auth | JWT HS256 (access + refresh) + Google OAuth (account linking) |
| Validation | Zod |
| ML gateway | Flask microservice (`./ml-service`) |
| Web enrichment | Firecrawl v1 API (via Flask service) |
| Payments | Razorpay (optional) |
| Migrations | migrate-mongo |

---

## Directory layout

```
backend/
├── src/
│   ├── index.js               # Express bootstrap, middleware order
│   ├── config/
│   │   ├── env.js             # Zod env validation + quota helpers
│   │   ├── db.js              # Mongoose connection
│   │   └── redis.js           # ioredis singleton
│   ├── models/                # Mongoose schemas
│   │   ├── User.js            # role, plan, monthly counters
│   │   ├── Job.js             # deduped job records (verificationHash)
│   │   ├── Verification.js    # trust-score snapshots
│   │   ├── Report.js          # user-facing report (links Verification + Job)
│   │   ├── Feedback.js        # thumbs up/down for retraining
│   │   ├── Group.js           # user report folders
│   │   ├── BulkJob.js         # bulk training jobs
│   │   ├── RetrainRun.js      # retrain history
│   │   ├── AdminNotification.js
│   │   ├── AuditLog.js
│   │   ├── ModelSetting.js    # live weight/threshold overrides
│   │   └── UsageLog.js
│   ├── middleware/
│   │   ├── auth.js            # JWT verification → req.auth
│   │   ├── rbac.js            # requireRole('admin')
│   │   ├── rateLimit.js       # express-rate-limit (general + auth + verify)
│   │   └── error.js           # global error handler + 404 handler
│   ├── controllers/
│   │   ├── authController.js         # signup, login, refresh, me, profile, change-pw, OAuth link/unlink
│   │   ├── verifyController.js       # quota gate → coalesce → ML → persist
│   │   ├── reportsController.js      # CRUD + PDF quota consumption
│   │   ├── groupsController.js       # user report folders
│   │   ├── feedbackController.js     # submit + admin list (supports ?pending=1)
│   │   ├── usageController.js        # /usage/me
│   │   ├── billingController.js      # Razorpay checkout / portal
│   │   ├── webhookController.js      # Razorpay webhooks (raw body)
│   │   ├── adminController.js        # users, analytics, audit logs, feedback list
│   │   ├── adminReportsController.js # ML admin analytics, labeled reports, CSV bulk
│   │   ├── mlAdminController.js      # settings, retrain, rescore, bulk jobs, notifications
│   │   ├── firecrawlController.js    # /firecrawl proxy
│   │   └── modelsController.js       # /models list from Flask
│   ├── routes/
│   │   ├── index.js           # mounts all routers under /api
│   │   ├── authRoutes.js
│   │   ├── verifyRoutes.js
│   │   ├── reportsRoutes.js
│   │   ├── groupsRoutes.js
│   │   ├── usageRoutes.js
│   │   ├── feedbackRoutes.js
│   │   ├── billingRoutes.js
│   │   ├── webhookRoutes.js   # mounted BEFORE express.json() — critical
│   │   ├── adminRoutes.js
│   │   ├── mlAdminRoutes.js
│   │   ├── firecrawlRoutes.js
│   │   └── modelsRoutes.js
│   ├── services/
│   │   ├── mlClient.js              # axios client for Flask (verifyCompany, scoreJob, etc.)
│   │   ├── verificationCoalescer.js # Redis single-flight + 6h cache
│   │   ├── retrainService.js        # posts feedback rows to Flask /retrain
│   │   ├── bulkJobWorker.js         # fire-and-forget bulk verification processor
│   │   └── tokenService.js          # JWT sign / verify helpers
│   ├── bootstrap/
│   │   └── adminSeed.js       # creates admin user on first boot
│   └── utils/
│       ├── asyncHandler.js    # express error-forwarding wrapper
│       └── apiError.js        # typed HTTP error factories
├── jobs/
│   └── retrainCron.js         # node-cron nightly retrain trigger
├── migrations/                # migrate-mongo scripts (indexes, bootstraps)
├── ml-service/                # Python Flask scoring engine (see its README)
├── .env.example
├── docker-compose.yml         # mongo + redis + api + ml service
└── package.json
```

---

## Local run

```bash
cp .env.example .env           # fill in values

# 1. Infrastructure
docker compose up -d mongo redis

# 2. ML service (separate shell)
cd ml-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scripts/train_seed.py   # promotes initial model
python app.py                  # listens on :8001

# 3. Run migrations + start API
cd ..
npm install
npm run migrate:up
npm run dev                    # listens on :8000
```

---

## Environment variables

Every value is read from `.env` — nothing is hardcoded. See `.env.example`
for the full list. Critically required vars:

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | Express port | `8000` |
| `MONGO_URI` | MongoDB connection string | — |
| `REDIS_URL` | Redis URL (optional in dev — coalescer degrades gracefully) | — |
| `JWT_SECRET` | HS256 access token signing key (≥ 16 chars) | — |
| `JWT_REFRESH_SECRET` | HS256 refresh token signing key (≥ 16 chars) | — |
| `JWT_ACCESS_TTL` | Access token TTL (e.g. `15m`) | `15m` |
| `JWT_REFRESH_TTL` | Refresh token TTL (e.g. `7d`) | `7d` |
| `JWT_ISSUER` | JWT issuer | `trusthire` |
| `FLASK_URL` | ML service base URL | `http://localhost:8001` |
| `ML_SERVICE_API_KEY` | Shared secret sent as `x-api-key` to Flask | — |
| `FIRECRAWL_API_KEY` | Firecrawl v1 key for web enrichment | — |
| `CORS_ORIGIN` | Comma-separated allowed origins (`*` for open) | — |
| `VERIFY_CACHE_TTL_SECONDS` | Verification cache TTL (seconds) | `21600` |
| `VERIFY_LOCK_TTL_SECONDS` | Verification lock TTL (seconds) | `30` |
| `FREE_VERIFY_QUOTA` | Free tier verifications per month | `10` |
| `FREE_DEEP_QUOTA` | Free tier Deep Think verifications per month | `1` |
| `FREE_PDF_QUOTA` | Free tier PDF exports per month | `2` |
| `PRO_VERIFY_QUOTA` | Pro tier verifications per month | `50` |
| `PRO_DEEP_QUOTA` | Pro tier Deep Think verifications per month | `10` |
| `PRO_PDF_QUOTA` | Pro tier PDF exports per month | `10` |
| `ADMIN_BOOTSTRAP_EMAIL` | First-boot admin email | — |
| `ADMIN_BOOTSTRAP_PASSWORD` | First-boot admin password | — |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (for account linking) | — |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret (for account linking) | — |
| `RAZORPAY_KEY_ID` | Razorpay key ID | — |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret | — |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook secret (for signature verification) | — |
| `RAZORPAY_PLAN_MONTHLY` | Razorpay plan ID for monthly Pro subscription | — |
| `RAZORPAY_PLAN_YEARLY` | Razorpay plan ID for yearly Pro subscription | — |
| `BILLING_SUCCESS_URL` | URL to redirect after successful payment | `http://localhost:5173/billing/success` |
| `BILLING_CANCEL_URL` | URL to redirect after canceled payment | `http://localhost:5173/billing/cancel` |
| `DISABLE_CRON` | Set to `1` to skip nightly retrain | — |
| `RETRAIN_MIN_FEEDBACK` | Minimum feedback rows to trigger retrain | `20` |
| `RETRAIN_CRON` | Cron schedule for retrain (default: daily at 3 AM) | `0 3 * * *` |

**Note**: For local development without network access, you can leave `FIRECRAWL_API_KEY` unset - the ML service will use offline stubs but remain functional.

---

## Google OAuth (account linking)

The backend provides two endpoints under `/api/auth/oauth/google/`:
- `POST /link` – links a Google account to the currently logged-in user (requires `googleId` in body, obtained from the frontend after Google sign-in).
- `POST /unlink` – unlinks the Google account from the currently logged-in user.

To enable Google OAuth:
1. Obtain `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from the [Google Cloud Console](https://console.cloud.google.com/).
2. Add them to your `.env` file.
3. On the frontend, after a successful Google sign-in (using Google's OAuth 2.0 flow), send the Google ID token (or the `sub` claim) to the `/api/auth/oauth/google/link` endpoint with an authenticated request (JWT in Authorization header).

Note: The existing JWT-based authentication (email/password) remains the primary login method. Google OAuth is used only for linking an existing account to a Google ID for convenience.

---

## Razorpay integration

TheBilling excluding Stripe and  using Razorpay for subscription is enabled by setting the following environment variables:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_PLAN_MONTHLY` (the plan ID for the monthly Pro subscription in Razorpay)
- `RAZORPAY_PLAN_YEARLY` (the plan ID for the yearly Pro subscription in Razorpay)

### How it works
1. When a user clicks "Subscribe" on the Pricing page, the frontend calls `/api/billing/checkout` with `{ provider: "razorpay", interval: "monthly"|"yearly" }`.
2. The backend creates a Razorpay subscription and returns the checkout URL (`short_url`).
3. The user completes payment on the Razorpay hosted page.
4. Razorpay sends a webhook to `/api/webhooks/razorpay` (signature verified).
5. The webhook updates the user's plan and billing details in the database.
6. The user can manage their subscription (cancel, etc.) via the portal endpoint `/api/billing/portal`.

### Testing
- Use Razorpay's test mode credentials to obtain test keys.
- Create test plans in the Razorpay dashboard (note the plan IDs) and set them as `RAZORPAY_PLAN_MONTHLY` and `RAZORPAY_PLAN_YEARLY`.
- Use test card numbers (e.g., `4111 1111 1111 1111`) for successful payments.

---

## Redis Pub/Sub — request coalescing

Verification is expensive (Firecrawl + ML). To prevent duplicate work when
many users query the same job simultaneously, `services/verificationCoalescer.js`
implements a single-flight pattern:

1. Hash `(input, mode, modelVersion)` → lock key `lock:verify:<hash>`.
2. First caller acquires a 30 s Redis `SETNX` lock, runs scoring, publishes
   the result on `verify:<hash>` and writes to cache `cache:verify:<hash>`
   (TTL 6 h, configurable via `VERIFY_CACHE_TTL_SECONDS`).
3. Concurrent callers subscribe to the channel and receive the same result —
   one scoring call serves N requests.
4. Repeat requests within 6 h are served from cache instantly.

If Redis is unreachable the coalescer falls back to running the verification
directly, logging a warning. The service stays functional.

---

## RBAC

`middleware/rbac.js` exports `requireRole('admin')`. Applied to all
`/api/admin/*` routes. Every request carries a JWT with `{ sub, role, plan }`
claims — the same `role` field used client-side by `<RequireAuth role="admin">`.

---

## Webhook signature verification

`/api/webhooks/*` is mounted with `express.raw()` **before** `express.json()`
in `src/index.js`. This is required for Razorpay HMAC signature validation.
Moving webhooks below the JSON parser will cause `invalid_signature` errors.

---

## Billing

Razorpay is optionally enabled. Leaving their env vars blank causes the
Profile page billing buttons to auto-hide. Both checkout and webhook flows are
implemented in `controllers/billingController.js` and `controllers/webhookController.js`.

---

## API surface

Full definitions in `src/routes/`. See the root `README.md` for the complete
endpoint table.

### Notable routes

| Method | Path | Notes |
|---|---|---|
| POST | /api/verify/company | Quota gate → coalescer → Flask → persist |
| GET | /api/reports/:id | Returns `{ report, verification, job }` |
| GET | /api/admin/feedback | Supports `?pending=1` and `?label=accurate\|inaccurate` |
| GET | /api/admin/ml/analytics | ML accuracy / precision snapshot |
| PUT | /api/admin/ml/settings | Weight + threshold override, pushes to Flask live |
| POST | /api/admin/ml/retrain | Manual retrain trigger |
| POST | /api/admin/ml/bulk | Enqueue bulk verification job |
| PATCH | /api/admin/ml/feedback/:id/include | Toggle training inclusion |

---

## Feedback + retrain cron

`jobs/retrainCron.js` runs on `RETRAIN_CRON` (default `0 3 * * *`). When
the unseen feedback batch is ≥ `RETRAIN_MIN_FEEDBACK` rows, it calls
`retrainService.js` which posts them to Flask `POST /retrain`. New model
versions must pass the 95% accuracy gate (`ACCURACY_GATE` in
`backend/ml-service/model/pipeline.py`) to be promoted to active.

---

## Hosting online

1. **Mongo + Redis** — managed instances (Atlas, Upstash).
2. **ML service** — `backend/ml-service/` to Railway/Render. `Procfile`
   runs seed on release then `gunicorn`. Set `ML_SERVICE_API_KEY` and
   `FIRECRAWL_API_KEY`.
3. **Express** — `backend/` to Render/Railway/Fly. Set all vars from
   `.env.example`. Run `npm run migrate:up` as a release step. Set
   `CORS_ORIGIN` to the frontend's public URL.
4. **Frontend** — build with `VITE_API_URL=https://api.<domain>/api` and
   publish `frontend/dist`.

---
