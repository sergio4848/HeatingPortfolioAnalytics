# Execution evidence — 2026-10-15

## Executed results
- Python 39 tests passed on Windows. The same 39 tests also passed inside the Linux application container (one upstream warning).
- Frontend typecheck and Vite production build passed. Vitest 2 brand/locale contract tests passed. Prettier check passed. Python Ruff lint passed.
- Playwright 4 tests passed against local SQLite app, then again against PostgreSQL Compose app: full import/mapping/analysis/building/task update/PDF+CSV journey, 1440/1024/390px body and document overflow assertions. reports/e2e-results.json is the latest PostgreSQL run. 11 screenshots are real browser captures.
- Docker Desktop 29.8.2 started successfully. docker compose up --build -d --wait completed. PostgreSQL and app report healthy. Port binding 127.0.0.1:8000 only. Alembic reports 001 (head). Repeated seed completed without adding duplicate buildings.
- Fresh SQLite database migration run twice and seed run twice in isolated subprocess test. 12 base buildings remain.
- PPTX finalization: 12 slides, package integrity pass, layout pass, 99 Arial text-script uses, zero findings, re-import successful. Evidence: presentation-validation.json.
- Every slide PNG inspected individually. Product overview 1 page; pilot 3 pages; brand guide 1 page, all visually inspected. Matching slide PDF 12 pages. No native PowerPoint run claimed.
- Native Artifact Tool PDF export fails in this runtime on missing #standard-fonts/Helvetica. Fallback ReportLab PDF embeds the exact twelve rendered slides. PPTX retains editable text and Turkish notes. Standalone PDFs remain text-based.
- Demo reports generated from a pristine 12-building signed session to align with the pitch source metrics. Journey reports separately contain the imported thirteenth synthetic example.

## Resolved failures
Initial oversized-upload status 422 changed to 413. Playwright Status selector changed to an accessible combobox role. Chart animation disabled for deterministic captures. Mobile absolute hidden-table label caused body overflow; positioned/clipped label fixed and both body/document measured. Vitest scope restricted to source unit tests. Deck font setter corrected to typeface:Arial, then finalizer passed. These checks were rerun after fixes.

## Remaining warning and scope
One upstream Starlette TestClient deprecation warning: current test transport uses httpx and upstream recommends httpx2. Tests pass. No dependency warning hidden or silenced.
Actual OIDC deployment, authorized customer data, real weather ingestion, expert model validation, legal agreements and operational production controls remain pending. Tests use real RSA signature verification with mocked JWKS transport, not a real identity provider. No independent accessibility audit, energy audit, field accuracy, annual savings or support eligibility claimed. GitHub CI run is only claimed if observed after push.

## Remote delivery and quality revision
User explicitly authorized remote delivery. Branch push succeeded. An initial GitHub Actions failure exposed OS-dependent .xlsm MIME handling; fix 87ac223 passed run https://github.com/sergio4848/HeatingPortfolioAnalytics/actions/runs/38727237167. Earlier upload-boundary notes are superseded.

Latest local revision: 43 Python tests, 10 frontend tests, 9 Playwright tests passed against PostgreSQL Compose. Typecheck, production build, Ruff and Prettier passed. npm audit reported zero vulnerabilities at scan time. The earlier counts above describe the original baseline, not the revised suite.

New browser checks cover table search/sorting/pagination, reload/back navigation, applied-date/report consistency, reset cancel/default focus/return focus/confirm, and HTTP error behavior without a replacement session. Original import/task/download journey and 1440/1024/390px overflow checks remain. Screenshots now wait for lazy chart SVGs before capture.

reports/accessibility/axe-1440.json and axe-390.json contain actual scans of landing, portfolio, building, import, tasks, interventions and settings. Selected WCAG 2 A/AA and 2.1 A/AA tags have zero detected violations. Initial insufficient helper-text contrast was corrected and scans rerun. Incomplete checks remain manual-review items. Automated results cannot certify complete WCAG conformance. Reset keyboard/focus behavior is separately tested.

Revised deck: Portotherm-LIAA-quality.pptx/pdf, same twelve-slide structure and editable text/notes, updated actual product screenshots. Finalizer again reports integrity/layout/font checks passed, 99 Arial uses, no findings, successful re-import. Unchanged native PDF limitation and fallback described above. Quality revision remote CI result is recorded in STATUS after observation.

Quality implementation b831a68 passed the expanded Linux/PostgreSQL GitHub workflow: https://github.com/sergio4848/HeatingPortfolioAnalytics/actions/runs/38729923038. Actual run/step metadata is preserved in github-actions-quality.json. No failed step remains in that run.

## Desktop/mobile follow-up
All seven views manually inspected in the running browser; extended overflow matrix covers 1440/1024/390/360px. Final local suite: 15/15 browser tests, 10/10 frontend tests, typecheck/build/format passed. Detailed findings, fixes and actual screenshots: ui-review/README.md. No Python changes in this follow-up; the full suite runs again in GitHub CI.
