# Design and engineering reference assessment

Reviewed 15 October 2026. Selection is based on fit with the existing React/TypeScript/FastAPI application, accessible interaction, maintainability and license compatibility. These are recommended references for this project; no universal ranking or performance benchmark is claimed. No upstream application or template was copied wholesale.

| Repository / primary documentation | Fit and decision | Applied here |
| --- | --- | --- |
| [shadcn/ui](https://github.com/shadcn-ui/ui), [theming](https://ui.shadcn.com/docs/theming) — MIT | Composable components and semantic tokens. Adopt the design approach without adding a second styling stack or copying a generic dashboard. | Product-specific navy/teal surfaces, typography, semantic CSS variables, consistent controls, spacing and focus states. |
| [Radix Primitives](https://github.com/radix-ui/primitives), [Alert Dialog](https://www.radix-ui.com/primitives/docs/components/alert-dialog) — MIT | Strong foundation for keyboard/focus behavior in consequential dialogs. | Installed Alert Dialog for demo reset, cancel-first focus, Escape, focus restoration, async/error states. |
| [TanStack Table](https://github.com/TanStack/table), [React v9 migration](https://tanstack.com/table/latest/docs/framework/react/guide/migrating) — MIT | Headless table preserves the product design while providing typed state and row models. | Current v9 sorting and pagination APIs; numeric ordering, null handling, search and report filters. |
| [Bulletproof React](https://github.com/alan2207/bulletproof-react) — MIT | Useful feature/component/API boundaries. A template migration would add unnecessary surface. | Extracted typed API/errors, domain types, formatting, route hook, table, dialog, status/header and lazy chart modules. Strict unused-code checks. |
| [Full Stack FastAPI Template](https://github.com/fastapi/full-stack-fastapi-template) — MIT | Official reference for a React/API/PostgreSQL testable stack. Preserve this project's explicit demo/pilot auth model. | PostgreSQL-backed CI service, migration and idempotent seed checks, typed validation errors and documented deployment gates. |
| [Playwright](https://github.com/microsoft/playwright) — Apache-2.0 | Browser behavior, responsive layouts and reports require real integration tests. | User journeys, routing/reload, search/sort/pagination, applied-period reports, reset focus and error-state tests. |
| [axe-core](https://github.com/dequelabs/axe-core) — MPL-2.0 | Automated accessibility checks augment keyboard and visual review. They cannot certify full WCAG conformance. | @axe-core/playwright scans WCAG 2 A/AA and 2.1 A/AA tags at desktop/mobile widths, with reviewable JSON evidence. |
| [Fontsource](https://github.com/fontsource/fontsource), [Inter usage](https://fontsource.org/fonts/inter/use) | Local font assets keep the interface independent of a third-party font request. | Self-hosted Inter variable font. Inter is SIL OFL-1.1; license copied into packages/brand/licenses. |

## Implementation boundaries

The existing numerical method, source provenance and synthetic disclosures remain explicit. Visual polish does not establish model accuracy, verified savings, security certification or production readiness. Real IdP deployment, approved customer/weather data, operational controls and expert review remain separate gates.

Versions are pinned in package-lock.json and requirements.lock.txt. CI actions are pinned to verified release commit SHAs. Automated accessibility evidence records violations and incomplete checks; incomplete/manual checks must not be presented as passed. THIRD_PARTY.md records distributed dependencies and notices.
