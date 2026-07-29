# TrustHire ML Service

Flask service that returns a 0–100 trust score for a job posting or company.

---

## Architecture overview

```
POST /verify-company
  │
  ├── verify/resolver.py   → resolve URL or company name
  ├── verify/enrichment.py → Firecrawl fallback enrichment
  ├── verify/mapper.py     → build score payload
  │
  ├── model/deep_think.py  → (Deep Think only) enrich with 140-feature set
  │
  ├── model/subscorers/
  │   ├── legal.py         → MCA CIN / registration status
  │   ├── gstin.py         → GST number cross-check
  │   ├── reputation.py    → Glassdoor + Reddit sentiment
  │   ├── domain.py        → WHOIS, TLS, email consistency
  │   ├── jd.py            → job description NLP red-flags
  │   ├── consistency.py   → cross-platform identity
  │   ├── financial.py     → headcount trend, revenue signals
  │   └── complaints.py    → TrustHire flags + cybercrime signals
  │
  ├── model/meta.py        → LogisticRegression + isotonic calibrator
  └── model/bands.py       → score → band (high / likely / caution / risk)
```

---

## Local setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # set FIRECRAWL_API_KEY, ML_SERVICE_API_KEY
python scripts/train_seed.py      # trains seed model, promotes to active
python app.py                     # http://localhost:8001
```

Health check: `curl http://localhost:8001/health`
→ `{ "ok": true, "model": "v0.0.0" }`

---

## Environment variables

| Variable | Purpose | Default | Required? |
|----------|---------|---------|-----------|
| `PORT` | Flask port | `8001` | No |
| `MODELS_DIR` | Directory for saved model artifacts | `./models` | No |
| `SEED_PATH` | Path to seed JSONL data | `./model/data/jd_seed.jsonl` | No |
| `FEEDBACK_LOG` | Append-only JSONL feedback log | `./models/feedback.jsonl` | No |
| `ML_SERVICE_API_KEY` | API key required in `x-api-key` header | — | Yes (for production) |
| `FIRECRAWL_API_KEY` | Firecrawl v1 key for enrichment fallback | — | Yes (for real web data) |

**Note**: For local development without network access, you can leave `FIRECRAWL_API_KEY` unset - the service will use offline stubs but remain functional.

---

## Configuration for ML_SERVICE_KEY

The `ML_SERVICE_API_KEY` secures your ML service endpoints. Here's how to configure it:

### Local Development
```env
# .env file
ML_SERVICE_API_KEY=dev-key-12345
FIRECRAWL_API_KEY=fc-your-key-here
```

### Docker Deployment
```bash
docker build -t trusthire-ml-service .
docker run -p 8001:8001 \
  -e ML_SERVICE_API_KEY=your-production-key \
  -e FIRECRAWL_API_KEY=fc-your-production-key \
  trusthire-ml-service
```

### Kubernetes Deployment
```yaml
env:
- name: ML_SERVICE_API_KEY
  valueFrom:
    secretKeyRef:
      name: ml-service-secrets
      key: ml-service-api-key
- name: FIRECRAWL_API_KEY
  valueFrom:
    secretKeyRef:
      name: ml-service-secrets
      key: firecrawl-api-key
```

### Railway/Render Deployment
Set these variables in your platform's dashboard:
- `ML_SERVICE_API_KEY`: Your secure API key
- `FIRECRAWL_API_KEY`: Get from https://firecrawl.dev

---

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /health | — | Liveness + active model version |
| GET | /models | key | List promoted model versions (max 2) |
| GET | /settings | key | Current weight + threshold overrides |
| POST | /settings | key | Update weights / thresholds live (no retrain) |
| GET | /metrics | key | Active model manifest (version, trained_at, metrics) |
| POST | /score | key | Score a pre-enriched payload (Normal mode) |
| POST | /score/deep-think | key | Score with Deep Think enrichment |
| POST | /verify-company | key | Full pipeline: resolve → enrich → score → report |
| POST | /feedback | key | Append a feedback row to the training log |
| POST | /retrain | key | Warm-start retrain from feedback log |
| POST | /bulk-csv | key | Parse uploaded CSV into input rows for bulk jobs |

`key` = `x-api-key: <ML_SERVICE_API_KEY>` header (required only when the env var is set; omit in local dev without a key).

---

## Normal vs Deep Think mode

### Normal mode (~85 features)

Uses feature groups A–C and G–J from `MODEL_FEATURES.md`:
- Company identity and registration (Group A, except `registered_address_consistency`)
- Core digital presence signals (Group B, excluding uptime/quality/social/SPF)
- Job posting signals (Group C)
- Recruiter and contact risk (Group G)
- NLP and semantic signals (Group H)
- Source and metadata (Group I)
- Temporal and feedback signals (Group J)
- Derived composite scores (partial)

### Deep Think mode (~140 features)

Includes everything in Normal mode, plus:
- `registered_address_consistency` (Group A)
- `website_uptime_score`, `website_quality_score`, `social_media_presence`,
  `cross_platform_identity_consistency`, `spf_record_present` (Group B)
- `duplicate_posting_detected` (Group C)
- Full reputation group D: Glassdoor rating, review velocity, sentiment
  distribution, platform agreement, Reddit signals
- Full complaint group E: fraud/cybercrime allegation counts, regulatory
  adverse signals, cybercrime flag
- Full financial group F: MCA filing activity, employee count trend,
  paid-up/authorised capital, office footprint
- Recruiter identity consistency + professional presence (Group G)
- Sentence embeddings (384-dim), embedding similarity (Group H)
- `source_domain_alexa_rank`, `number_of_sources` (Group I)
- `overall_reputation_score` and `financial_stability_score` composite scores

`model/deep_think.py:enrich()` stubs all Deep Think fields with safe defaults
when real data is unavailable, so the subscorers always receive a complete
feature vector.

---

## `/score` and `/score/deep-think` request schema

```json
{
  "title": "Senior Backend Engineer",
  "company": "Acme Pvt Ltd",
  "description": "Full job description text…",
  "salary": "18–32 LPA",
  "scraped": {
    "mca":         { "status": "active", "cin": "U72200KA2015PTC012345" },
    "gstin":       { "status": "found", "number": "29ABCDE1234F1Z5" },
    "reputation":  { "glassdoor": 4.1, "reddit_sentiment": 0.3, "mentions": 42 },
    "domain":      { "age_days": 2200, "recruiter_matches_company": true },
    "consistency": { "cross_platform_matches": 2 },
    "financial":   { "headcount_growth": 0.12, "revenue_known": true },
    "complaints":  { "count": 0 }
  },
  "model": "v0.0.1",
  "noise": false
}
```

`scraped` is optional — omit it and the subscorers will use defaults.
`model` selects a specific promoted version (omit for active). `noise` adds
small Gaussian jitter (σ=3 Normal, σ=1.5 Deep Think) so identical inputs
return slightly different scores — a spec requirement.

---

## `/score` response

```json
{
  "modelVersion": "v0.0.1",
  "trustScore": 84,
  "band": "likely",
  "reason": "Strong MCA registration and clean domain signals. Minor reputation data gap.",
  "deepThink": false,
  "parameters": [
    {
      "key": "legal",
      "label": "Legal & Registration",
      "weight": 0.20,
      "score": 95,
      "status": "Active CIN",
      "evidence": "CIN U72200KA2015PTC012345 active on MCA."
    }
  ]
}
```

Bands: `high` (≥80) · `likely` (≥60) · `caution` (≥40) · `risk` (<40).
Thresholds are admin-configurable via `PUT /settings`.

---

## `/verify-company` full pipeline

Accepts: `input` (URL or company name), `deepThink` (bool), `model` (version),
`mode` (`fresh` bypasses enrichment cache), `noise` (bool).

```bash
curl -s http://localhost:8001/verify-company \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: dev-key' \
  -d '{"input": "https://examplecorp.in/jobs/backend", "deepThink": false}'
```

---

## Enrichment pipeline

`verify/enrichment.py` is the Firecrawl fallback enrichment layer:

1. Attempts MCA-style lookup (stubbed — returns `status: unknown` for
   non-Indian companies or when offline).
2. When MCA returns `unknown`, falls back to Firecrawl web search for:
   - Reputation: Glassdoor/Reddit review sentiment + hit count (`mentions`).
   - Complaints: scam/fraud/police/SEBI signal detection from search snippets.
     Extracts `cybercrime_complaint_flag`, `regulatory_adverse_signal`,
     `fraud_allegation_count` for Deep Think subscorer compatibility.
3. Domain signals from URL parsing (age, recruiter domain match).
4. All results are cached in-process for 600 s (configurable).

Without `FIRECRAWL_API_KEY` the client returns an `offline` stub — the
pipeline keeps running with default values.

To verify Firecrawl is working:
1. Ensure `FIRECRAWL_API_KEY` is set in your `.env`
2. Test with: `curl -X POST http://localhost:8001/verify-company -H "x-api-key: dev-key" -H "Content-Type: application/json" -d '{"input": "https://examplecorp.in/jobs/backend"}'`
3. Check logs for Firecrawl API responses vs offline stubs

---

## Model training

### Seed model

```bash
python scripts/train_seed.py
```

Generates synthetic training data weighted to match the spec weights, fits a
LogisticRegression meta-scorer + isotonic calibrator, and promotes it as the
active model.

### Retraining from feedback

`POST /retrain` (called by the Express cron or admin UI):

```json
{
  "rows": [
    { "label": 1, "sub_scores": { "legal": 95, "reputation": 60, … } },
    …
  ],
  "bump": "patch",
  "settings": { "weights": { "legal": 0.22, … } }
}
```

The new model must reach 95% accuracy on the held-out slice to be promoted
(configured by `ACCURACY_GATE` in `model/pipeline.py`). If it fails, the
previous active model remains.

### Model registry

Up to 2 promoted versions are retained (configurable in `model/registry.py`).
The Express backend can list them via `GET /api/models` and allow admins to
pick a specific version for verification.

---

## Deploy to Railway (recommended)

```bash
cd backend/ml-service
railway init
railway up
```

Nixpacks installs from `requirements.txt`. The `Procfile` runs:

```
release: python scripts/train_seed.py
web: gunicorn app:app --bind 0.0.0.0:$PORT
```

Set `ML_SERVICE_API_KEY` and `FIRECRAWL_API_KEY` in Railway Variables.
Point the Express backend's `FLASK_URL` at the Railway service URL.

---

## Deploy to Render

1. New Web Service → connect repo → Root Directory: `backend/ml-service`.
2. Build command: `pip install -r requirements.txt && python scripts/train_seed.py`
3. Start command: `gunicorn app:app --bind 0.0.0.0:$PORT`
4. Add environment variables.

---

## Running tests

```bash
source .venv/bin/activate
python3 -m pytest tests/ -v
```

Tests in `tests/test_pipeline.py` and `tests/test_verify.py` exercise the
scoring pipeline offline (no Firecrawl key required).

---

## Troubleshooting Firecrawl

If enrichment seems stale or returns default values:

1. **Check API Key**: Ensure `FIRECRAWL_API_KEY` is set in `.env`
2. **Test Connectivity**: 
   ```bash
   curl -X POST "https://api.firecrawl.dev/v1/search" \
     -H "Authorization: Bearer fc-your-key" \
     -H "Content-Type: application/json" \
     -d '{"query":"test company","limit":1}'
   ```
3. **Clear Cache**: The enrichment layer caches results for 10 minutes. Restart the service or modify code to bypass cache during testing.
4. **Check Logs**: Look for `[enrichment] source:firecrawl` vs `[enrichment] source:offline` in service logs.

---