# Acceptance checklist

Statuses distinguish local demonstration from real-data pilot and production.

| Deliverable | Criterion | Evidence | Status |
|---|---|---|---|
| Existing repository | Inspect before changing | Empty clone, dedicated branch; STATUS | Done |
| Deterministic data | ≥10 buildings, 24–36 months, distinct scenarios | 12 buildings/33 months, seed 4848, separate labels, generator tests | Done |
| Unit/calendar validation | Independently calculated conversions and inclusive periods | 1.25 MWh/50m²=25kWh/m², leap February tests | Passed |
| Input quality | Negative/unknown/duplicate/area/date/cumulative issues visible | Validation tests; import blocks all row errors | Passed; cumulative differencing deferred |
| Analysis | Own-history, nonnegative reference; time separation | Model tests, future-data mutation test | Passed on synthetic inputs |
| Weather/summer/insufficient | Cold-weather distinction, zero HDD/reference, meter changes | Scenario and edge tests | Passed; real weather pending |
| Imports | CSV/XLSX, mapping, preview, commit and duplicate policy | API/browser tests, values-only XLSX/formula/zip tests | Passed |
| Task flow | Assignment, action, assessment, due/priority/status/history | API and browser update/save/history | Passed |
| Interventions | Record scope/date/cost source and show post-data limits | Seeded examples and browser screen | Passed descriptively; no causal verification |
| Reports | Filtered CSV and PDF; disclosure/date/method/limits | Browser downloads, PDF text tests, empty CSV disclosure test | Passed |
| Tenant boundary | Server-selected organization, reports included | Foreign building/task/report tests and signed JWT tests | Passed in tests |
| Pilot roles | Verified JWT; admin/analyst/viewer checks | Signed RSA tokens with mocked JWKS retrieval | API tested; real IdP/browser login pending |
| Upload security | Byte/row/expanded zip/formula limits | Chunked request, 10,000-row and unsafe XLSX tests | Passed; hard CPU deadline pending |
| Fresh installation | Schema migration/seed idempotency | Fresh SQLite subprocess test; Compose evidence in reports/validation | SQLite fresh migration/seed and PostgreSQL Compose passed |
| Responsive/accessibility | 1440/1024/390, labelled forms, focus, chart tables | Playwright overflow, reset keyboard/focus, axe scans across seven views at desktop/mobile and inspected screenshots | Passed for tested paths; no independent WCAG audit |
| Brand | Three directions, vector variants, PNG/icons, short guide | packages/brand and brand-guide PDF | Delivered; clearance pending |
| Research/claims | Ten names, alternatives, explicit hypotheses | Research and claim register | Limited desk review; legal/domain clearance pending |
| Meeting package | 12 editable slides/PDF, overview, 3-page pilot, bilingual prep | exports, source and docs/meeting | Delivered; founder facts pending |
| Visual QA | Inspect every slide and standalone PDF page | Twelve rendered slides; 1+3+1 standalone pages | Inspected; not tested in native PowerPoint |
| CI | Lint/typecheck/build/tests without secrets | .github/workflows/ci.yml | Baseline remote run passed; quality revision result in STATUS |
| Real pilot | Authorized records, weather, identity, legal, specialist | Explicit gates in README/privacy/roadmap | Not ready until gates completed |
| Production | Operational security/backup/concurrency/retention | Threat model and roadmap | Not production ready |

Numbers describe synthetic software behavior. No actual customer savings, field accuracy, customer traction, support eligibility or funding approval claimed. Execution details and outstanding warnings are in reports/validation.md.


## Claude update

Implemented/locally verified optional AI evidence, approval, quotas, sources, landing motion and responsive routes: [current validation](../reports/claude-update.md). Live provider/model access and real-data pilot gates remain open; synthetic tests are not field proof.
