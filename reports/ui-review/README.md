# Desktop and mobile review — 15 October 2026

The running local PostgreSQL application was opened and operated in the Codex browser. Landing, portfolio, building detail, import, review tasks, interventions and settings were inspected at desktop and mobile sizes. Additional states inspected: task creation/cancel, CSV selection/mapping/validation, empty audit load, reset confirmation/cancel, building charts and landing pilot anchor. No customer data was used. The browser console reported no captured errors during the manual review.

Manual browser viewport checks used 1440×1000, 390×844 and 360×844. These are browser viewport checks, not physical-phone or native Safari validation.

## Corrected findings

| Finding | Change |
| --- | --- |
| Grid forms inherited large label margins and a 450px width cap | Scoped form-grid labels, compact spacing, full-width textareas and aligned columns. |
| Date fields clipped on small screens; small text and controls were hard to use | Two-column date row, full-width filter rows, 16px mobile fields and 44px minimum control height. |
| CSV/XLSX actions overflowed the 360px viewport | Action groups wrap within available width. |
| Reset was hidden with the mobile sidebar footer | Added the same accessible reset dialog to mobile settings. |
| Reset left client-side previews/drafts and a native file selection visible | Cleared preview, task, mapping, file input and cached audit state after successful reset. |
| Empty task message remained underneath the task editor | Show it only when no editor is open. |
| Empty audit response looked the same as an unloaded audit | Explicit loaded-empty state, refresh action, human-readable event titles, UTC timestamps and optional recorded details. |
| Horizontal table scrolling was hard to discover | Visible small-screen hint and a keyboard-focusable labelled table region. |
| Edited dates could be mistaken for the currently applied reporting period | Added a pending-period message; report links continue using the applied period. |

## Executed verification

- 15 Playwright tests passed against PostgreSQL Compose; no skipped/flaky/unexpected tests in the recorded final local run.
- All seven screens checked for body/document overflow at 1440, 1024, 390 and 360px: 28 combinations passed. Per-screen dimensions are in layout-*.json.
- Desktop/mobile reset tests validate stale-preview removal, cleared file choice, disabled preview until a new file, empty audit, saved settings and readable refreshed audit events.
- Existing import/task/history/report-download journey, table search/sort/pagination, navigation/reload, period consistency, error handling and reset focus checks continue to pass.
- axe checks at 1440/390px still report zero detected violations for the selected WCAG tags. Incomplete/manual checks remain recorded under ../accessibility; no complete WCAG certification is claimed.
- Typecheck, production build, 10 frontend tests and Prettier passed. Python/API behavior was unchanged in this revision; remote CI runs the full Python suite again.

The PNGs are actual Playwright captures of the running app, including all seven views at 1440/390px, task forms and both reset dialogs. CI retains this directory with browser evidence. Source run results: ../e2e-results.json. Actual remote results are recorded in STATUS.md and linked in the delivery response.

Real-data pilot, brand clearance and production gates remain unchanged.


## 16 October update

Current evidence adds eleven views at 1440/1024/768/390/360px, landing gallery/route/reduced-motion checks, optional AI controls, source notes/error/long-name states and local performance observations. See [current validation](../claude-update.md); older review findings remain historical.
