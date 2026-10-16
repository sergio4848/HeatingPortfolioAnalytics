"""Evidence assembled exclusively from the authenticated tenant and numerical engine."""

import hashlib
import json
from urllib.parse import quote, urlencode
from fastapi import HTTPException
from .db import get, all_items


def digest(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False).encode()
    ).hexdigest()


def evidence(s, c, results, bid, start, end):
    if not get(s, c["tenant"], "Building", bid):
        raise HTTPException(404, "Building not found")
    result = next(x for x in results(s, c, start, end) if x["id"] == bid)
    sources = [
        {
            "id": "analysis",
            "title": "Versioned monthly analysis",
            "kind": "analysis",
            "data": {
                "method": result["method"],
                "period_start": start,
                "period_end": end,
                "reference": result["model"],
                "quality": result["quality"],
                "limitations": result["limitations"],
                "flagged_months": result["flagged_months"],
            },
        }
    ]
    for row in result["trace"]:
        if row["evaluation"]:
            sources.extend(
                [
                    {
                        "id": "consumption:" + row["period_start"],
                        "title": "Consumption " + row["period_start"],
                        "kind": "record",
                        "data": {
                            k: row.get(k)
                            for k in (
                                "period_start",
                                "period_end",
                                "heat_kwh",
                                "source_reference",
                                "includes_dhw",
                            )
                        },
                    },
                    {
                        "id": "weather:" + row["period_start"],
                        "title": "Weather " + row["period_start"],
                        "kind": "weather",
                        "data": {
                            k: row.get(k)
                            for k in ("period_start", "hdd", "coverage", "base_c", "station", "source")
                        },
                    },
                ]
            )
    interventions = [x for x in all_items(s, c["tenant"], "Intervention") if x["building_id"] == bid]
    for item in interventions:
        sources.append(
            {"id": "intervention:" + item["id"], "title": item["kind"], "kind": "intervention", "data": item}
        )
    documents = [x for x in all_items(s, c["tenant"], "BuildingDocument") if x["building_id"] == bid]
    for doc in documents:
        for page in doc["pages"]:
            sources.append(
                {
                    "id": f"document:{doc['id']}:{page['page']}",
                    "title": f"{doc['title']} / page {page['page']}",
                    "kind": "document",
                    "data": {
                        "document_id": doc["id"],
                        "date": doc["date"],
                        "version": doc["version"],
                        "page": page["page"],
                        "text": page["text"],
                        "source": doc["source"],
                    },
                }
            )
    metrics = {}

    def metric(id, label, value, unit):
        metrics[id] = {"label": label, "value": value, "unit": unit, "source_ids": ["analysis"]}

    metric("observed_kwh", "Observed consumption", result["observed_kwh"], "kWh")
    metric("expected_kwh", "Weather reference", result["expected_kwh"], "kWh")
    metric("residual_kwh", "Observed minus reference", result["residual_kwh"], "kWh")
    metric("deviation", "Observed deviation", result["deviation"], "ratio")
    metric("missing_months", "Missing evaluation months", result["missing_months"], "months")
    metric("training_months", "Training history", (result["model"] or {}).get("training_months"), "months")
    ev = [x for x in result["trace"] if x["evaluation"]]
    metric(
        "weather_coverage",
        "Mean coverage of available evaluation weather rows",
        sum(x["coverage"] for x in ev) / len(ev) if ev else None,
        "ratio",
    )
    state = {
        "building_id": bid,
        "name": result["name"],
        "period": {"start": start, "end": end},
        "method": result["method"],
        "status": result["status"],
        "quality": result["quality"],
        "metrics": metrics,
        "sources": sources,
        "disclosure": c["data_type"],
        "trace_fingerprint": digest(result),
    }
    state["analysis_version"] = digest(state)
    for source in sources:
        source["url"] = (
            f"/api/ai/buildings/{quote(bid, safe='')}/sources/{quote(source['id'], safe='')}?{urlencode({'start': start, 'end': end})}"
        )
    return state


def model_evidence(pack):
    """No full consumption history or unnecessary organization/user identifiers transmitted."""
    sources = []
    for x in pack["sources"]:
        if x["kind"] in ("analysis", "intervention", "document"):
            data = dict(x["data"])
            if "text" in data:
                data["text"] = data["text"][:1000]
                data["excerpt_only"] = True
            sources.append({"id": x["id"], "title": x["title"], "kind": x["kind"], "data": data})
    return {
        k: pack[k]
        for k in (
            "building_id",
            "period",
            "method",
            "status",
            "quality",
            "metrics",
            "analysis_version",
            "disclosure",
        )
    } | {"sources": sources[:10]}
