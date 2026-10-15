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
