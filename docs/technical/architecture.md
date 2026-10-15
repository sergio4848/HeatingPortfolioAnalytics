# Architecture

React browser → same-origin FastAPI /api → tenant-scoped SQLAlchemy store. Alembic owns migration. Compose targets PostgreSQL 17 and healthchecked application startup. SQLite is the verified local alternative. FastAPI serves the frontend build, without runtime CDN dependency; Vite proxies /api during development.

File → bounded validation → column mapping → normalized preview → explicit commit → versioned analysis run → derived findings → review task/history → intervention → report. Raw bytes are discarded. Normalized previews remain until reset/admin deletion. Small synchronous processing fits pilot scope; hard CPU deadline remains operational work.

Entity keys are tenant/kind/id. Kinds: Organization, User, Membership, Building, ConsumptionRecord, WeatherRecord, ImportBatch, AnalysisRun, Finding, Task, Intervention, AuditEvent. Synthetic scenario labels remain separate from model inputs. The same analysis functions drive UI, API, reports and presentation statistics.

JSON entities currently use last-writer-wins. The local single-reviewer demo is supported; production needs row versions, normalized relationships and stronger constraints. Persisted findings are review snapshots, not a complete finding scheduler. ISO dates, kWh energy, UTC audit timestamps. OpenAPI: /api/openapi.json.

## Frontend boundaries and period consistency

Shared domain types, typed API/validation errors, formatting and portfolio/report selectors live in src/types.ts and src/lib. Headless TanStack v9 table handles sorting/pagination; parent filters/search also scope exports. Radix Alert Dialog owns reset focus/keyboard behavior. Hash routes preserve building navigation on reload and browser back. Recharts loads in a separate dynamic chunk; chart tables remain available as text. An error boundary provides a recoverable render fallback. Inter font assets are served locally.

Draft date inputs are separate from the applied range. A successful portfolio response applies the range; reports use that same range. A request sequence prevents older responses overwriting newer selections. Server building detail accepts and validates the same date range. Consumption records are grouped once per analysis request rather than rescanned for every building. This is a structural efficiency change, not a measured production performance claim.

GitHub CI uses pinned official action release commits, Node 24, Python 3.11, ephemeral PostgreSQL 17, migration/repeated-seed checks, frontend checks and real Chromium journeys/axe scans. API unit tests use isolated SQLite fixtures; browser integration tests exercise PostgreSQL in CI/Compose. Browser evidence is retained for seven days.
