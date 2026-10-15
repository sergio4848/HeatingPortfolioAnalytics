"""Reproduce source data without deleting any database content."""

import csv
import json
from pathlib import Path
from apps.api.synthetic import generate

root = Path(__file__).resolve().parents[1]
data = generate()
target = root / "data/synthetic"
target.mkdir(parents=True, exist_ok=True)
with (target / "consumption.csv").open("w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(data["raw"][0]))
    writer.writeheader()
    writer.writerows(data["raw"])
for name in ("weather", "buildings", "labels", "interventions"):
    (target / f"{name}.json").write_text(json.dumps(data[name], indent=2), encoding="utf-8")
