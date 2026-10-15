import calendar
import random
from .analysis import validate


def generate(seed=4848):
    rng = random.Random(seed)
    weather = {}
    for year in (2024, 2025, 2026):
        for month in range(1, 13):
            if year == 2026 and month > 9:
                continue
            hdd = [540, 470, 370, 190, 65, 8, 0, 4, 80, 230, 380, 490][month - 1]
            if year == 2026 and month in (1, 2):
                hdd *= 1.35
            weather[f"{year}-{month:02}-01"] = dict(
                hdd=hdd, coverage=1, base_c=15.5, source="Synthetic weather, seed 4848", station="SYNTHETIC"
            )
    buildings, raw = [], []
    scenarios = [
        "normal",
        "cold_weather",
        "persistent_deviation",
        "missing_duplicates",
        "units_area",
        "meter_change",
        "intervention",
        "recent_intervention",
        "normal",
        "normal",
        "normal",
        "normal",
    ]
    labels = {}
    for i, scenario in enumerate(scenarios, 1):
        bid = f"SYN-{i:03}"
        area = 1800 + i * 310
        b = dict(
            id=bid,
            name=f"Building {i:02}",
            heated_area_m2=area,
            building_type="Panel" if i % 2 else "Masonry",
            year=1960 + i * 3,
            apartments=25 + i * 4,
            renovation="Unknown",
            quality_issues=[],
        )
        if scenario == "meter_change":
            b["meter_change"] = "2026-03-01"
            b["quality_issues"].append("Meter/use changed in March 2026; pre-change baseline excluded")
        if scenario == "missing_duplicates":
            b["quality_issues"].append("Missing months and a duplicate source row")
        if scenario == "units_area":
            b["quality_issues"].append("Mixed kWh/MWh converted; zero-area source row rejected")
        for index, (start, wx) in enumerate(weather.items()):
            year, month = int(start[:4]), int(start[5:7])
            if scenario == "missing_duplicates" and index in (3, 7, 27, 30):
                continue
            kwh = (1.6 * area * calendar.monthrange(year, month)[1] / 30 + area * 0.022 * wx["hdd"]) * (
                1 + rng.uniform(-0.025, 0.025)
            )
            if scenario == "persistent_deviation" and year == 2026:
                kwh *= 1.45
            if scenario == "meter_change" and start >= "2026-03-01":
                kwh *= 1.3
            if scenario == "intervention" and start >= "2026-04-01":
                kwh *= 0.85
            unit = "MWh" if scenario == "units_area" and index % 2 else "kWh"
            row = dict(
                building_external_id=bid,
                period_start=start,
                period_end=f"{year}-{month:02}-{calendar.monthrange(year, month)[1]}",
                heat_consumption=round(kwh / (1000 if unit == "MWh" else 1), 5),
                heat_unit=unit,
                heated_area_m2=area,
                measurement_type="consumption",
                includes_dhw="true",
                source_reference=f"synthetic-{index}",
            )
            raw.append(row)
            if scenario == "missing_duplicates" and index == 12:
                raw.append(row.copy())
            if scenario == "units_area" and index == 20:
                raw.append(dict(row, heated_area_m2=0))
        labels[bid] = scenario
        buildings.append(b)
    clean, issues = validate(raw)
    interventions = [
        dict(
            id="INT-1",
            building_id="SYN-007",
            kind="Hydraulic review",
            start="2026-04-01",
            end="2026-04-15",
            scope="Synthetic balancing scenario",
            expected_effect="Lower weather-adjusted consumption",
            cost=None,
            cost_source="",
            notes="No causal claim",
        ),
        dict(
            id="INT-2",
            building_id="SYN-008",
            kind="Maintenance",
            start="2026-09-01",
            end="2026-09-15",
            scope="Synthetic recent intervention",
            expected_effect="Review after more months",
            cost=None,
            cost_source="",
            notes="Not enough post-intervention data",
        ),
    ]
    return dict(
        buildings=buildings,
        records=clean,
        raw=raw,
        weather=weather,
        issues=issues,
        interventions=interventions,
        labels=labels,
    )
