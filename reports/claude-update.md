# Product / Claude update validation / 16 October 2026

## Implemented

Existing Portotherm name/logo, FastAPI/React/SQLAlchemy storage and deterministic NNLS engine retained. Backend Claude contracts, evidence/source records, text notes/text-PDF ingestion, citation checks, approved/idempotent task drafts, bounded read-only assistant tools, tenant quotas and metadata audit are implemented. UI is wired to real backend routes. There is no production fake-AI mode or frontend API key.

Landing uses the four documented design references: short GSAP entrances/ScrollTrigger counter-motion, localized Draggable, Lenis through one ticker, UI UX Pro Max accessibility/hierarchy guidance and an independent DOM horizontal gallery informed by Codrops. Mobile/tablet/reduced motion remain vertical/native. Direct dashboard loads do not request the landing-motion bundle. Buildings, Findings, Reports and Assistant are reachable through Workspace views.

## Executed local checks

- Python: 95 passed, including 25 deterministic AI contract evaluation fixtures and mocked provider scenarios. Raw result: `python-tests.xml`. Tests include numeric/source rejection, missing evidence, cache/stale version, explicit task approval/idempotency, tenant isolation/extra tool arguments, viewer permissions/real-data gate, PDF text/scanned rejection, rate limits, bounded retry, timeout, no-key operation and core import/analysis regression.
- Frontend: 10 Vitest tests passed. Typecheck/production build, Ruff and Prettier passed.
- Chromium browser suite: final combined report in `e2e-results.json`; 23 scenarios. AI source modal/edited task approval has one explicitly named MOCK protocol test, with no provider call or delivery screenshot. Remaining tests use actual local API data; no live provider result is implied.
- Eleven views at 1440/1024/768/390/360px: 55 layout combinations. Captured desktop/mobile views, task forms/reset dialogs, local maintenance note, evidence error and long building name. Tablet four-column metric overflow was fixed. Findings exclude within-reference buildings; Settings title precedes controls; duplicate Buildings search removed.
- Automated axe selected WCAG 2/2.1 A/AA tags: zero violations across eleven views at 1440 and 390px. Incomplete checks remain in `accessibility/axe-*.json`; not independent certification.
- Gallery arrows, keyboard Home/End, desktop drag, route cleanup, reduced-motion vertical layout, mobile menu Escape, explicit import revalidation, source note save/remove, errors and table overflow checked. Browser operated manually for landing desktop/mobile and tablet issue diagnosis; actual screenshots inspected across app views.
- Local performance observer: `ui-review/performance-local.json` records Chromium 1440x1000, fresh context, no CPU/network throttling. This is a local laboratory observation, not Lighthouse, a frame-rate guarantee or field Core Web Vitals. No unsupported score claim.
- SQLite migration 001→002 and seed executed in temporary ignored `work/qa.db`. Docker daemon was unavailable in this session; PostgreSQL verification is delegated to the actual GitHub Actions run and recorded only after it completes.

## Visual deliverables

Twelve-slide editable PPTX and matching twelve-page PDF regenerated with current actual portfolio/building/AI screenshots. All twelve slide renders and five standalone PDF pages inspected. One-pager remains one page, proposed pilot three pages, brand guide one page. Native Artifact Tool PDF export still lacks #standard-fonts/Helvetica; matching slide-render PDF used. PPTX remains editable; no native PowerPoint rendering claimed. `presentation-validation.json` records package/layout/font/import checks. Previous quality exports remain historical revisions.

## Live API and pilot limitations

No live Anthropic request was made: neither process environment nor app-local ignored .env contained a configured key when checked. Mock protocol success is not live API verification or field validation. User can configure the backend locally, restart it, enable organization AI and use the opt-in synthetic-only `scripts/live_ai_check.py`. The script is not automatically run in CI and never prints a key.

Remaining pilot gates: provider account/model availability and all five live feature paths; expert assessment of explanation relevance and residual language hallucinations; authorized real records, data-processing terms/provider policy, real weather/station matching, external identity/browser login, reviewed Latvian copy. OCR remains deferred. Hard process cancellation, general API rate limiting, retention/backups/session cleanup and production operations remain hardening work. Current bounded AI validation cannot establish causality, fault diagnosis or guaranteed savings.

Design/source/license details: `docs/design/references.md`. AI flows/security/pricing source/date: `docs/technical/ai-architecture.md`. Remote Actions evidence is added after the authorized push; local success alone is not remote CI success.


## Observed remote result

b346663 passed [Actions run 38935202356](https://github.com/sergio4848/HeatingPortfolioAnalytics/actions/runs/38935202356): 95 Python, 10 frontend and 23 browser tests; PostgreSQL migration/repeated seed passed. Detailed run/steps: github-actions-claude.json. The final assistant building-label refinement passed all 52 AI tests locally and is included in the subsequent verification push.
