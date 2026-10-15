# Data dictionary

| Entity | Principal fields | Meaning |
|---|---|---|
| Organization | name, threshold, unit, data_type | Tenant settings |
| User | id, label | Fictional demo role; pilot identity external |
| Membership | subject, role | Server provisioned admin/analyst/viewer |
| Building | id, heated_area_m2, building_type, quality_issues, meter_change | Stable ID and baseline metadata |
| ConsumptionRecord | building_external_id, period_start/end, days, heat_kwh, heated_area_m2, includes_dhw, source_reference | Physical monthly consumption |
| WeatherRecord | period_start, hdd, coverage, base_c, station, source | Weather provenance and coverage |
| ImportBatch | sha 256, records, issues, preview, conflicts, status, written, skipped | Validation evidence; no raw file |
| AnalysisRun | id, batch_id, method, at | Model/import trace |
| Finding | id, building_id, status, method | Human-review snapshot |
| Task | assignee, technical_action, note, priority, status, due, history | Action distinct from user assessment |
| Intervention | kind, start/end, scope, cost/source, expected_effect, notes | Recorded event, no inferred causality |
| AuditEvent | actor, action, at, details | Tenant decisions/parameter changes |

Required source fields: building_external_id, period_start, period_end, heat_consumption, heat_unit, heated_area_m2, measurement_type, includes_dhw, source_reference. measurement_type must be consumption; includes_dhw true/false/unknown. Optional tariffs, vacancy and richer renovation metadata are not yet automatically mapped. No resident/apartment data required.
