# Architecture Notes

- Single-process TypeScript service using Fastify.
- Local persistence uses SQLite with idempotent upserts and unique constraints.
- The sync flow is account-driven, matching upstream API boundaries.
- The scoring engine is deterministic and pure for reproducibility and testability.
- `sync_runs` is stored for operational traceability and easier incident debugging.

## Data Ownership

- Upstream Banking API owns account and raw transaction source of truth.
- This service owns synced local copy, aggregation, score calculation, and explainability payload.

## Scalability Path

- Replace SQLite with PostgreSQL (same schema shape).
- Move sync to background jobs and batch writes.
- Add materialized monthly aggregates for faster score reads.

