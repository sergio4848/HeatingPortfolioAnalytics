# Architecture

React browser → same-origin FastAPI /api → tenant-scoped SQLAlchemy store. Alembic owns migration. Compose targets PostgreSQL 17 and healthchecked application startup. SQLite is the verified local alternative. FastAPI serves the frontend build, without runtime CDN dependency; Vite proxies /api during development.

File → bounded validation → column mapping → normalized preview → explicit commit → versioned analysis run → derived findings → review task/history → intervention → report. Raw bytes are discarded. Normalized previews remain until reset/admin deletion. Small synchronous processing fits pilot scope; hard CPU deadline remains operational work.

Entity keys are tenant/kind/id. Kinds: Organization, User, Membership, Building, ConsumptionRecord, WeatherRecord, ImportBatch, AnalysisRun, Finding, Task, Intervention, AuditEvent. Synthetic scenario labels remain separate from model inputs. The same analysis functions drive UI, API, reports and presentation statistics.

JSON entities currently use last-writer-wins. The local single-reviewer demo is supported; production needs row versions, normalized relationships and stronger constraints. Persisted findings are review snapshots, not a complete finding scheduler. ISO dates, kWh energy, UTC audit timestamps. OpenAPI: /api/openapi.json.
