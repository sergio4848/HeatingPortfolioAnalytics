# Claude / evidence architecture

## Engine and model responsibilities

The existing NNLS monthly analysis remains authoritative. Claude is optional and backend-only (`ai_provider.py`, `ai_routes.py`). No provider call occurs from browser code. The core portfolio, manual import, task editing, source notes, text-PDF extraction and exports run without a key. No production mock-provider mode is present. Tests substitute the gateway explicitly; `live_claude` responses inside these tests are test doubles, not observed live model execution.

Default: configurable `ANTHROPIC_MODEL=claude-sonnet-5-5`, Python SDK `anthropic==1.15.0`. The official models/SDK/structured output/tool/citation/PDF/error docs below were checked on 16 October 2026. Sonnet list-price estimate: $2 input / $10 output per million tokens, without cache discounts. Custom models require configured rates. Estimates are not provider invoices.

## Data flows

1. **Column suggestion:** existing CSV/XLSX parser → tenant import preview → user approves transfer of headers and at most three bounded sample rows → Claude JSON schema → strict Pydantic/source/target validation → individual suggestions selected → manual map changes → normal parser revalidation → explicit existing import commit. Financial/cumulative columns cannot be suggested as consumption. Optional cost remains cost, with EUR and source metadata. Units, whole-month ISO dates and decimal input follow the deterministic parser. Missing units are never invented or persisted. Manual mapping is always available.
2. **Finding explanation:** the server assembles actual building/period/reference/weather/quality/method/maintenance source evidence. JSON output contains observations, possible explanations, recommended checks, missing information and limitations. Backend-rendered metric IDs supply numbers. Unknown sources/metrics, model-authored digits/numeric-unit phrases and prohibited certainty are rejected. Null observation metrics require missing-information disclosure; a basic direction check rejects explicit contradiction of the engine. This is a conservative validation layer, not proof that every natural-language inference is true. Human review remains required.
3. **Maintenance:** tenant/building text notes and text PDFs are parsed locally. Immutable date/provenance/version/page/character positions are retained; raw PDF bytes discarded. Limit: ten documents/building, 2 MB, thirty pages, forty thousand extracted characters. Encrypted, scanned-only and unreadable PDFs are rejected; OCR is deferred. Simple text search reads current records directly; no vector database. The separate native-citation request sends at most four bounded text excerpts. Citation document index, range, quote and numeric support are checked; every output block needs a citation. Sources are opened through authorized endpoints. Deletion removes source records and related explanation/draft/assistant caches; there is no separate persistent search index.
4. **Task:** finding → validated draft → editable checks/role/title/note → unchecked explicit save approval → writer authorization → recomputed analysis/source version and freshness → transactional task insert plus audit. Stable task ID makes approval retry/double-click idempotent. The model has no create/assign-task tool. Suggested role is not an actual assignment to a person; no messages are sent.
5. **Portfolio assistant:** six read-only tools (`list_buildings`, `get_building_summary`, `list_findings`, `get_finding_evidence`, `list_interventions`, `search_building_documents`). Tenant derives from the authenticated backend context. Extra arguments such as organization_id are forbidden. At most four provider rounds, six tool calls, eight buildings/list and six thousand characters/tool result; request context also bounded. Final answer references gathered backend metrics/sources. Unsupported or invalid answers fall back to filters/evidence. No SQL/shell/web/device/messaging tools.

## Consent, state and freshness

Server `AI_ENABLED` and key, admin organization opt-in, explicit real-data permission where applicable, and per-request transfer approval are separate gates. UI names the data sent and the optional provider. All file/cell/document/question content is untrusted data. Output is escaped React text, never raw HTML.

A SHA-256 fingerprint covers actual engine result, period, method and authorized source content. Explanation/draft/mapping caches are tenant scoped and keyed by model/prompt/version; reuse lasts fifteen minutes. Generated responses expire for approval/current checks after one hour; analysis/source changes mark them stale. Documents invalidate derived cache entries. Assistant/maintenance responses are versioned but are not reused from cache. The client also compares the current building evidence and disables stale draft approval.

## Costs and reliability

`AIQuota` is a separate migrated table (002) with atomic tenant/UTC-day conditional reservations, safe across workers. Defaults: thirty requests, two hundred thousand conservative reserved tokens and five USD estimated daily budget. Reservations are retained until reset, including failed attempts. This intentionally may stop early. Actual returned usage is recorded separately. SDK retries are disabled; one bounded retry honors short Retry-After for rate limit/connection/server failures. Request deadline defaults to 35 seconds (hard configured ceiling 45); each HTTP call is bounded to twelve seconds. Max output 1800 tokens, context 48KB; tool loops share the invocation deadline/budget. No timeout/rate failure replaces the engine.

AIUsage stores feature/model/prompt version/time/token usage/duration/provider calls/validation/error class/estimated cost and cache status. Blocked requests and cache hits are recorded without raw prompts, customer documents, API keys or arbitrary provider error bodies. HTTP authorization still fails closed. Database task provenance and audit records retain the source IDs and analysis version. No raw customer documents are written to application logs.

## Configure and verify

For manual startup, export environment variables before starting Python; Python does not auto-load `.env`. Compose reads its local ignored `.env` and forwards only declared variables. Never use VITE_ variables for secrets. Restart the backend after adding a key. Then enable the organization under Settings and approve each request. API status returns configuration booleans, never the key.

```powershell
$env:AI_ENABLED='true'
# Set ANTHROPIC_API_KEY locally without sharing it in chat or committing it.
$env:ANTHROPIC_MODEL='claude-sonnet-5-5'
python -m alembic upgrade head
python -m uvicorn apps.api.main:app --host 127.0.0.1 --port 8000
```

The opt-in `python scripts/live_ai_check.py` creates an isolated synthetic demo session, enables AI only for that session and requests one finding explanation after explicit script consent. It never records a key or document. It makes a paid provider call only when both `AI_LIVE_TEST_CONSENT=synthetic-only` and a configured backend are present. It does not prove live task/citation/tool accuracy. Current delivery has no live provider result because no key was available.

## Official sources

- [Model IDs and prices](https://platform.claude.com/docs/en/models/overview)
- [Python SDK](https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/python)
- [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
- [Citations](https://platform.claude.com/docs/en/build-with-claude/citations)
- [PDF support](https://platform.claude.com/docs/en/build-with-claude/pdf-support)
- [Errors and Retry-After](https://platform.claude.com/docs/en/api/errors)

Native citations and JSON structured output are incompatible in one request according to the reviewed docs. Maintenance therefore uses a separate native-citation flow; explanations/tasks use validated application source IDs with JSON schema. PDF capability was reviewed, but this application sends extracted text, not raw PDFs. Live API behavior, provider account/model access, Latvian source formats, legal permission and expert-rated explanation usefulness remain pilot gates.
