# Threat model and gaps

Boundaries: untrusted browser/file → parser/API; API → tenant store; external IdP → verified subject. File names never become paths. Every building/task/batch/report lookup uses server-owned tenant; request organization IDs cannot override it. Signed HttpOnly SameSite strict demo cookies expire after eight hours. Hosted settings require HTTPS, Secure cookies and a stable strong secret. Default random process secret invalidates sessions on restart.

Files: 2 MB, 10,000 rows, 60 unique headers, macro-free XLSX, max 300 zip entries/20 MB expanded size. Traversal, external links and VBA rejected. Formulas rejected, never evaluated. defusedxml hardens openpyxl XML parsing. Formula-leading CSV export cells receive a quote prefix. No raw upload content/name logging. Erroneous batches cannot commit.

Pilot verifies RS 256 signature, issuer, audience and expiry through PyJWT, then uses explicit membership. Admin changes critical settings; analyst imports/reviews; viewer reads/reports. Configuration missing means fail closed. Tests exercise missing/foreign tenant data and roles; actual IdP staging remains pending.

Do not publish local demo. Remaining: rate limiting, hard processing deadline, request/session quotas, session garbage collection, OIDC browser login, CSP, TLS/HSTS, centralized operational log retention, backups/restore drill, dependency scanning and incident process. Row/expanded-size limits indirectly bound parser work, not a hard CPU deadline. Public session creation could exhaust storage. Pre-parser middleware bounds total request bytes even without Content-Length and caps body receipt at 15 seconds; chunked-upload tests pass. Retain upstream limits for production defense in depth. No security/GDPR certification.

Demo reset deletes only the signed session tenant. Base seed is idempotent and does not delete existing records. Raw bytes discarded immediately; normalized previews/tasks persist locally until reset. Cookie expiry is not automatic data deletion. Proposed pilot deletion within 30 days after completion needs contractual agreement and implementation, including backups.
