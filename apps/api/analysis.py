"""Monthly, out-of-time, non-negative weather reference. No scenario labels are inputs."""

from datetime import date, timedelta
import math
import numpy as np

VERSION = "monthly-nnls-1.0"
DISCLOSURE = "Synthetic demo data — not measured customer results"


def number(value):
    result = float(str(value).strip().replace(",", "."))
    if not math.isfinite(result):
        raise ValueError("Value must be finite")
    return result


def parse_date(value):
    if isinstance(value, date):
        return value.date() if hasattr(value, "hour") else value
    # ISO is mandatory: ambiguous 01/02/2025 must never be guessed.
    return date.fromisoformat(str(value).strip())


def validate(rows):
    clean, issues, seen, periods, areas = [], [], set(), {}, {}
    for index, row in enumerate(rows, 2):
        try:
            bid = str(row["building_external_id"]).strip()
            if not bid or len(bid) > 80:
                raise ValueError("Building ID must contain 1–80 characters")
            start, end = parse_date(row["period_start"]), parse_date(row["period_end"])
            days = (end - start).days + 1
            if start.day != 1 or end != (start.replace(day=28) + timedelta(days=4)).replace(
                day=1
            ) - timedelta(days=1):
                raise ValueError("Monthly periods must cover one complete calendar month")
            value, area = number(row["heat_consumption"]), number(row["heated_area_m2"])
            if value < 0 or area <= 0:
                raise ValueError("Consumption must be non-negative and heated area must be positive")
            unit = str(row["heat_unit"]).strip()
            if unit not in ("kWh", "MWh"):
                raise ValueError("Unknown unit. Only kWh and MWh accepted; no volume/currency conversion")
            if row.get("measurement_type") != "consumption":
                raise ValueError(
                    "Cumulative readings require reviewed differencing and reset handling; use consumption"
                )
            if str(row.get("includes_dhw", "")).lower() not in ("true", "false", "unknown"):
                raise ValueError("includes_dhw must be true, false or unknown")
            key = (bid, start.isoformat(), end.isoformat())
            if key in seen:
                raise ValueError("Duplicate building/month; row excluded, never summed")
            if any(start <= b and end >= a for a, b in periods.get(bid, [])):
                raise ValueError("Overlapping period")
            if bid in areas and area != areas[bid]:
                raise ValueError("Heated area changed: split or review the building baseline before import")
            seen.add(key)
            areas[bid] = area
            periods.setdefault(bid, []).append((start, end))
            clean.append(
                dict(
                    building_external_id=bid,
                    period_start=start.isoformat(),
                    period_end=end.isoformat(),
                    days=days,
                    heat_kwh=value * (1000 if unit == "MWh" else 1),
                    heated_area_m2=area,
                    includes_dhw=str(row["includes_dhw"]).lower(),
                    source_reference=str(row.get("source_reference", ""))[:250],
                )
            )
        except (ValueError, KeyError, TypeError) as exc:
            issues.append(
                {
                    "row": index,
                    "building": str(row.get("building_external_id", "unknown")),
                    "message": str(exc),
                }
            )
    return clean, issues


def fit_reference(rows):
    if len(rows) < 18 or len({r["period_start"][5:7] for r in rows}) < 10:
        return None
    if max(r["hdd"] for r in rows) - min(r["hdd"] for r in rows) < 200:
        return None
    x = np.array([[r["days"], r["hdd"]] for r in rows], dtype=float)
    y = np.array([r["heat_kwh"] for r in rows], dtype=float)
    # Exact two-variable NNLS: unconstrained optimum plus both boundary optima.
    candidates = [
        np.maximum(np.linalg.lstsq(x, y, rcond=None)[0], 0),
        np.array([max(0, x[:, 0] @ y / (x[:, 0] @ x[:, 0])), 0]),
        np.array([0, max(0, x[:, 1] @ y / max(1, x[:, 1] @ x[:, 1]))]),
    ]
    coef = min(candidates, key=lambda c: float(np.sum((x @ c - y) ** 2)))
    return {
        "base_kwh_day": float(coef[0]),
        "heating_kwh_hdd": float(coef[1]),
        "training_start": rows[0]["period_start"],
        "training_end": rows[-1]["period_end"],
        "training_months": len(rows),
        "training_mae_kwh": float(np.mean(abs(x @ coef - y))),
    }


def analyze(
    building, records, weather, evaluation_start="2026-01-01", evaluation_end="2026-09-30", threshold=0.2
):
    history = sorted(
        [
            dict(r, **weather[r["period_start"]])
            for r in records
            if r["period_start"] in weather and weather[r["period_start"]]["coverage"] >= 0.9
        ],
        key=lambda r: r["period_start"],
    )
    change = building.get("meter_change")
    train = [
        r
        for r in history
        if r["period_end"] < evaluation_start and (not change or r["period_start"] >= change)
    ]
    evaluation = [
        r for r in history if evaluation_start <= r["period_start"] and r["period_end"] <= evaluation_end
    ]
    model = fit_reference(train)
    trace, flags = [], []
    for row in history:
        expected = (
            (model["base_kwh_day"] * row["days"] + model["heating_kwh_hdd"] * row["hdd"]) if model else None
        )
        residual = row["heat_kwh"] - expected if expected is not None else None
        pct = residual / expected if expected and expected >= 100 else None
        eligible = row in evaluation
        flagged = bool(
            eligible and pct is not None and pct > threshold and residual > 3000 and row["hdd"] >= 100
        )
        if flagged:
            flags.append(row["period_start"])
        trace.append(
            dict(
                row,
                expected_kwh=expected,
                residual_kwh=residual,
                deviation=pct,
                evaluation=eligible,
                flagged=flagged,
            )
        )
    # Require at least two adjacent calendar months, not simply two arbitrary observations.
    persistent = any(
        (date.fromisoformat(b).year * 12 + date.fromisoformat(b).month)
        - (date.fromisoformat(a).year * 12 + date.fromisoformat(a).month)
        == 1
        for a, b in zip(flags, flags[1:])
    )
    ev = [r for r in trace if r["evaluation"]]
    observed = sum(r["heat_kwh"] for r in ev)
    expected = sum(r["expected_kwh"] or 0 for r in ev) if model else None
    residual = observed - expected if expected is not None else None
    missing = max(
        0,
        (date.fromisoformat(evaluation_end).year - date.fromisoformat(evaluation_start).year) * 12
        + date.fromisoformat(evaluation_end).month
        - date.fromisoformat(evaluation_start).month
        + 1
        - len(ev),
    )
    quality = "review required" if building.get("quality_issues") or missing else "usable"
    status = (
        "insufficient data"
        if not model or len(ev) < 3
        else ("investigate" if persistent else "within reference")
    )
    # Quality problems do not produce reassuring green scores.
    if quality != "usable" and status == "within reference":
        status = "data review"
    deviation = residual / expected if expected and expected >= 100 else None
    priority = (
        round(min(100, max(0, (deviation or 0) * 100) + len(flags) * 5)) if status == "investigate" else 0
    )
    return dict(
        building,
        model=model,
        status=status,
        quality=quality,
        missing_months=missing,
        observed_kwh=observed,
        expected_kwh=expected,
        residual_kwh=residual,
        deviation=deviation,
        intensity_kwh_m2=observed / building["heated_area_m2"],
        priority=priority,
        flagged_months=flags,
        trace=trace,
        method=VERSION,
        evaluation_start=evaluation_start,
        evaluation_end=evaluation_end,
        reason=f"{len(flags)} evaluation months exceed {threshold:.0%} and 3,000 kWh; persistence required. "
        + (
            "A review priority, not a fault diagnosis."
            if model
            else "At least 18 valid training months with season coverage required."
        ),
        limitations=[
            "Monthly data only; no equipment diagnosis or verified savings.",
            "Synthetic weather, HDD base 15.5°C; no station match for customer data.",
            "Domestic hot water is not separated. Occupancy and meter changes can confound results.",
        ],
    )
