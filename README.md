# Backend Challenge — Thin-File Credit Builder
## Description

A TypeScript/Fastify service that synchronizes banking transactions and computes an explainable Reliability Index for thin-file users.

## Stack

- Node.js + TypeScript
- Fastify
- SQLite (`better-sqlite3`)
- Vitest

### Why Fastify?

Fastify provides strong TypeScript support, low overhead, and a small API surface. It keeps this challenge implementation simple while remaining production-ready.

## Why SQLite?

For a take-home, SQLite keeps setup deterministic and easy to review. In production, I would use PostgreSQL for stronger concurrency, operational tooling, and scaling.

## Project Structure

- `src/routes`: route registration only (URL -> controller)
- `src/controllers`: HTTP handlers (validation + response mapping)
- `src/services`: use-case orchestration (`sync`, `reliability`)
- `src/domain`: deterministic scoring logic and window calculations
- `src/repositories`: DB access layer (SQL queries and persistence operations)
- `src/infrastructure`: Banking API client, DB connection, schema/migration
- `docs/diagrams`: architecture and sequence diagrams
- `scripts`: one-command local run and smoke checks

### Diagram Sources

- `docs/diagrams/architecture.mmd`
- `docs/diagrams/sequence-sync.mmd`
- `docs/diagrams/sequence-score.mmd`

## Setup and Run

### Quick Review

```bash
cp .env.example .env
npm install
npm run migrate
npm run dev
```

In another terminal:

```bash
./scripts/smoke.sh
```

### Option A: One-Command Run

```bash
./scripts/dev.sh
```

### Option B: Manual

```bash
cp .env.example .env
npm install
npm run migrate
npm run dev
```

Service starts on `http://localhost:3100` by default.

## API Usage

All endpoints accept optional `X-Correlation-Id`; if omitted, the service generates one and echoes it in the response header.

Authentication note:

- Challenge service endpoints (`/api/users/...`) are intentionally unauthenticated for local review simplicity.
- Upstream Banking API calls are authenticated with `Authorization: Bearer <BANKING_API_KEY>` configured via `.env`.

### 1) Sync transactions

```bash
curl -sS -X POST "http://localhost:3100/api/users/user_1001/sync" | cat
```

Example response:

```json
{
  "user_id": "user_1001",
  "synced_accounts": 2,
  "new_transactions": 168,
  "duplicate_transactions": 0,
  "synced_from": "2025-09-01"
}
```

### 2) Compute reliability

```bash
curl -sS "http://localhost:3100/api/users/user_1001/reliability?from=2026-02-20" | cat
```

The reliability response also includes scoring metadata for auditability:

```json
{
  "model_version": "v1",
  "calculated_at": "2026-02-20T12:00:00.000Z"
}
```

### Smoke script

```bash
./scripts/smoke.sh
```

`smoke.sh` is a quick reviewer helper that runs a minimal end-to-end check in sequence:

1. Calls `GET /health`
2. Calls `POST /api/users/:userId/sync`
3. Calls `GET /api/users/:userId/reliability?from=...`

It is useful for fast verification without typing multiple curl commands.

### From-Scratch Verification (Reviewer Friendly)

Reset local state:

```bash
rm -f .env
cp .env.example .env
rm -f data/dev.db data/dev.db-wal data/dev.db-shm
```

Start service in one terminal:

```bash
npm run dev
```

Then verify behavior in a second terminal:

```bash
curl -sS -i "http://localhost:3100/health" | cat
curl -sS -i "http://localhost:3100/api/users/user_1001/reliability?from=2026-02-20" | cat
curl -sS -i -X POST "http://localhost:3100/api/users/user_1001/sync" | cat
curl -sS -i "http://localhost:3100/api/users/user_1001/reliability?from=2026-02-20" | cat
```

Expected sequence:

- `health` returns `200`
- `reliability` before sync returns `404` (no locally synced transactions yet)
- `sync` returns `200` and persists data locally
- `reliability` after sync returns `200` with score payload

Note: if the database is deleted while the service is still running, restart the service before re-testing to avoid stale-process confusion.

## Scoring Model

This service follows the assignment's deterministic model and computes:

- Reliability index (`0..100`) and score band (`LOW`/`MEDIUM`/`HIGH`)
- Required metrics in the response payload
- Human-readable `drivers` explaining major positive/negative contributors

Implementation notes:

- 6-month calendar window is computed from the `from` query date (inclusive)
- Merchant category dictionary is used dynamically (for essential/savings/fees/high-risk grouping)
- The final score is clamped to `0..100`

## Data Model

### `accounts`

Stores upstream account metadata keyed by upstream account id.

### `transactions`

Local immutable transaction store with a `UNIQUE` constraint on `external_txn_id` to guarantee idempotent sync.

### Query Indexing

Query paths are indexed based on expected access patterns (`user_id`, `account_id`, `booking_date`, plus composite date indexes).

### `merchant_categories`

Cached dictionary to keep category-group logic deterministic and queryable.

### `sync_runs`

Operational audit trail of each sync attempt (`started/completed/failed`) with counts and errors.

## Assumptions and Trade-offs

- Single currency (`EUR`) as required.
- For assignment simplicity, sync imports the full discovery range (`data_range.from` to `data_range.to`). In production, I would support incremental sync and date-bounded sync.
- Estimated negative balance days use cumulative net transaction flow over the window, not true ledger opening balances (limitation).
- Current implementation is synchronous for simplicity; async job queues would be preferred at scale.

## Architecture Decisions

I intentionally kept repositories and the Banking API client as concrete implementations. Introducing interfaces would be straightforward if additional persistence backends or upstream providers become requirements, but would add unnecessary complexity for the current scope.

### Why `accounts` + `transactions`?

The upstream integration is account-scoped. Keeping both entities improves traceability and account-level troubleshooting.

### Why cache merchant categories locally?

Scoring relies on category groups (`essential`, `savings`, `fees`, `high_risk`). Local caching keeps scoring deterministic and avoids repeated upstream fetches.

### Why `sync_runs`?

I intentionally persist sync runs to improve operational visibility, support troubleshooting, and enable safe retries.

In production, this table can also power monitoring, alerting, and reconciliation workflows.

## Idempotency

Synchronization is idempotent. Repeated `POST /api/users/:userId/sync` requests do not duplicate transactions because `external_txn_id` is uniquely constrained.

## Scoring Limitations and Bias Considerations

- Category-driven scoring relies on upstream categorization quality.
- Thin-file users with irregular income patterns can be systematically underrated.
- Negative balance estimation is approximate without full ledger snapshots.
- High-risk category penalties may correlate with demographic/behavioral patterns that need fairness monitoring.

## Discussion Topics (Design Notes)

- **API evolution**: assignment endpoints are intentionally kept unchanged (`/api/users/...`).
  In production, I would expose versioned endpoints such as
  `/api/v1/users/:userId/sync` and `/api/v1/users/:userId/reliability`, include
  `model_version` in responses, and treat new scoring signals as additive fields
  for backward compatibility. Major scoring formula changes would be introduced
  as a new model version (`v1`, `v2`, ...) so historical and current scores can
  coexist for auditability.
- **Consistency/idempotency**: unique transaction key + `sync_runs` enable safe retries and forensic analysis.
- **Sync strategy**: current flow is on-demand sync per user request. In production, I would move to incremental scheduled sync and support webhook-driven updates when upstream events are available.
- **Scalability**: move to PostgreSQL, add background workers, pre-aggregate monthly features.
- **Caching**: cache dictionary and computed score snapshots; invalidate on successful sync.
- **Auditability**: persist score run artifacts (model version + metrics) in a dedicated table if needed.
- **Incident handling**: structured logs, sync_run status, and endpoint-level timing metrics.

## Data Ownership

- Banking API owns source-of-truth accounts, transactions, and merchant categories.
- Reliability Service owns synchronization state, score computation, and explainability drivers.

## External API Reliability

Current implementation fails fast on upstream errors. In production, I would add explicit timeout policies, exponential backoff with retry budgets, and circuit-breaker safeguards.

The current implementation includes a configurable upstream request timeout (`BANKING_API_TIMEOUT_MS`) to avoid hanging calls.

## Security Considerations

This challenge uses a mock API and local SQLite for simplicity.

In production, I would add:

- Secret management (for example AWS Secrets Manager)
- IAM least privilege for service roles
- Encryption at rest and in transit
- Audit logging and retention controls
- Request validation hardening and rate limiting

## Logging Behavior

For this challenge, logging is intentionally simple and structured:

- `src/config/logger.ts` writes JSON logs to `stdout` (`info`) and `stderr` (`error`)
- There is no local `logs/` directory or rotating file sink
- Each request log includes correlation context for easier troubleshooting

Production improvements:

- Use a production logger backend/sink (for example CloudWatch, ELK, Datadog)
- Add log redaction for sensitive fields and enforce retention policies
- Add metrics/tracing integration and alerting on error-rate and latency signals

## Merchant Category Refresh Strategy

For simplicity, merchant categories are loaded once if the local cache is empty.

In production, I would refresh the dictionary periodically or version dictionary snapshots to keep scoring behavior explicit and traceable over time.

## Production Evolution

- Move from SQLite to PostgreSQL
- Add background workers for scheduled incremental sync
- Add Redis caching for score snapshots and dictionary reads
- Support webhook/event-driven transaction updates

## Scoring Reproducibility and Drift Detection

For fintech-grade auditability, production design should persist score inputs/outputs per run and monitor drift via count/hash/aggregate checks between local data and upstream data.

## Tests

```bash
npm test
```

Current tests focus on deterministic scoring behavior.

## AI Usage

AI tools were used for brainstorming, validating ideas, and reviewing implementation approaches. All architectural decisions, implementation, testing, and final verification were completed by me.


