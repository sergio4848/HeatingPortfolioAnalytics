# Risks and 30/60/90-day targets

| Risk | Response | Owner to confirm | Trigger |
|---|---|---|---|
| Sparse history | Insufficient-data state | Data owner | <18 training months |
| Misleading weather | Synthetic disclosure, real station validation | Energy expert | No verified weather match |
| False inference | Human review, no diagnosis | Product owner | Expert rejects finding |
| Mixed DHW/meter changes | Caveats and baseline exclusion | Manager | Meter/use changed |
| Privacy/access | Agreements and pilot gates | Legal/operator | Before real transfer |
| Tenant leak | Server-scoped keys/access tests | Engineering | Every new endpoint/export |
| Brand collision | Provisional identity, clearance | Founder/IP reviewer | Before commercial use |
| Cleanup cost | Scope and price tests | Founder | Labor exceeds pilot budget |
| Unknown team capacity | Verified profile/open roles | Founder | Before meeting |
| Operational fragility | Local demo, fail-closed pilot | Engineering | Before hosting |

Days 1–30: complete founder profile, confirm meeting privately, interview managers, find authorized sample/expert, choose legal/hosting/identity route and weather source, configure/test OIDC.

Days 31–60: agreed 5–10-building pilot, real data-quality review, expert decisions, simpler seasonal baseline comparison, threshold calibration, time/cost measurement. Add reviewed weather import and browser login.

Days 61–90: commercial go/no-go, price test, production access/backup/retention/concurrency controls, reviewed Latvian translation. Expansion depends on evidence. No acceptance or revenue milestone presumed.
