# Methodology — monthly-nnls-1.0

Whole calendar-month inclusive periods only. kWh is canonical. MWh ×1000 = kWh; intensity = kWh/heated m². Independent example: 1.25 MWh /50 m² =25 kWh/m². February 2024 has 29 inclusive days. ISO date strings avoid ambiguity.

Never derive physical energy from invoice money or undocumented gas-volume conversion. Negative/nonfinite consumption, nonpositive area and unknown units fail. Cumulative readings require reviewed differencing/reset handling and are rejected in this version. Area changes block the shared baseline. Duplicates, overlaps, incomplete months and missing fields are visible; erroneous batches cannot commit.

## Reference and time separation

Default training: 2024-01 through 2025-12. Evaluation: 2026-01 through 2026-09. Every training row ends strictly before evaluation_start. At least 18 valid months, ten distinct calendar months, weather coverage ≥90%, and HDD range ≥200 are required. At least three evaluation months are needed for performance status. Records before a documented meter change are excluded, possibly yielding insufficient data.

E_t = a × days_t + b × HDD_t, a,b ≥0.

Two-variable least-squares candidates include the nonnegative interior and both boundary optima. Choose the least squared error. Base load a is not separately measured domestic hot water. Collinearity, DHW and sparse seasons can confound interpretation.

Demo weather uses HDD base 15.5°C as a synthetic assumption. Daily HDD is positive base-minus-outdoor-temperature summed over a month; this demo supplies monthly HDD directly. A different base changes the fitted a/b partition. Pilot work must compare bases and validate station/location, provenance and coverage. Real weather ingestion is not implemented.

R_t = O_t − E_t; deviation = R_t/E_t only when E_t ≥100 kWh. No division by HDD: zero HDD is safe. An evaluation month flags when residual >3,000 kWh AND deviation >threshold (default 20%) AND HDD ≥100. Investigation requires two adjacent flagged calendar months. Summer changes remain descriptive; the rule can miss summer base-load problems.

Priority = min(100, max(0, period_deviation ×100) +5 ×flagged_month_count). It is review order, not fault probability, confidence or savings. Thresholds require pilot calibration. Quality problems remain visible even with a finding; otherwise they produce data review instead of a green status. Missing evaluation months are explicit.

## Independent example and validation

For a=100 kWh/day, b=20 kWh/HDD, days=30 and HDD=300, reference is 9,000 kWh. Observed 13,500 gives residual 4,500 and deviation 50%. Two adjacent eligible months yield investigation. At HDD=450 and observed 12,000 the residual is zero. Independent tests construct known-coefficient data separately from the generator.

Training MAE is an in-sample diagnostic, not independent accuracy. Evaluation is out of time. Separate scenario labels never enter analyze(). Synthetic tests do not establish field accuracy, false-positive rate or customer savings. No prediction interval/confidence percentage is produced. Real pilot needs walk-forward validation, residual review, comparison with simpler seasonal baselines and expert feedback.

## Interventions and claim limits

Show complete evaluation months before/after an event. Fewer than three complete post months or no usable baseline yields insufficient post-intervention data. Otherwise observed/reference −1 is descriptive. No causal inference, annualization or financial saving is claimed. Usage, DHW, tariff, renovation, meter and occupancy changes confound results. The intervention interval is excluded from post months.

No certified measurement/verification, audit replacement, diagnosis, guaranteed saving, real-time claim or actual customer outcome. Peer benchmarking waits for comparable metadata and adequate samples.
