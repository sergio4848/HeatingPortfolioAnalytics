# API examples

Interactive schema: http://127.0.0.1:8000/api/docs

```sh
curl -c demo.cookies -X POST http://127.0.0.1:8000/api/session
curl -b demo.cookies http://127.0.0.1:8000/api/portfolio
curl -b demo.cookies http://127.0.0.1:8000/api/buildings/SYN-003
curl -b demo.cookies -F 'file=@data/templates/consumption.csv;type=text/csv' http://127.0.0.1:8000/api/imports/preview
curl -b demo.cookies -H 'Content-Type: application/json' -d '{"policy":"reject"}' http://127.0.0.1:8000/api/imports/REPLACE_BATCH_ID/commit
curl -b demo.cookies -H 'Content-Type: application/json' -d '{"building_id":"SYN-003","note":"Check invoice","priority":"high"}' http://127.0.0.1:8000/api/tasks
curl -b demo.cookies 'http://127.0.0.1:8000/api/reports/pdf?bid=SYN-003' -o evidence.pdf
```

Never commit cookies. Portfolio/audit support offset/limit. Date filters use ordered ISO start/end; reports accept kind/quality/status. Preview accepts JSON source-header → canonical-header mapping. Codes: 401 session, 403 role/origin, 404 tenant-scoped missing object, 409 duplicates/idempotency, 413 size, 415 MIME, 422 validation, 503 unconfigured pilot.

Pilot: set trusted issuer/audience/JWKS and provision exactly one Membership entity for verified token sub. Use Authorization: Bearer. No custom password flow. Demo UI does not implement OIDC login; authenticated API clients only until pilot browser-login integration. No token local storage.
