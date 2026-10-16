"""Small, bounded model contracts. No model-authored numeric facts enter the UI."""

import re
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

PROMPT_VERSION = "portotherm-ai-1"
FIELDS = (
    "building_external_id",
    "period_start",
    "period_end",
    "heat_consumption",
    "heat_unit",
    "heated_area_m2",
    "measurement_type",
    "includes_dhw",
    "source_reference",
    "cost",
    "currency",
)


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Point(Strict):
    text: str = Field(min_length=1, max_length=650)
    metric_ids: list[str] = Field(max_length=8)
    source_ids: list[str] = Field(min_length=1, max_length=8)


class Explanation(Strict):
    observations: list[Point] = Field(min_length=1, max_length=5)
    possible_explanations: list[Point] = Field(max_length=5)
    recommended_checks: list[Point] = Field(min_length=1, max_length=5)
    missing_information: list[Point] = Field(max_length=5)
    limitations: list[Point] = Field(min_length=1, max_length=5)


class Check(Strict):
    action: str = Field(min_length=1, max_length=350)
    question: str = Field(min_length=1, max_length=350)


class Draft(Strict):
    title: str = Field(min_length=1, max_length=160)
    evidence_summary: str = Field(min_length=1, max_length=650)
    checks: list[Check] = Field(min_length=1, max_length=6)
    missing_information: list[str] = Field(max_length=6)
    suggested_role: str = Field(min_length=1, max_length=100)
    closure_records: list[str] = Field(min_length=1, max_length=6)
    metric_ids: list[str] = Field(min_length=1, max_length=8)
    source_ids: list[str] = Field(min_length=1, max_length=10)


class Column(Strict):
    source_column: str = Field(max_length=120)
    target_field: Literal[
        "building_external_id",
        "period_start",
        "period_end",
        "heat_consumption",
        "heat_unit",
        "heated_area_m2",
        "measurement_type",
        "includes_dhw",
        "source_reference",
        "cost",
        "currency",
        "unmapped",
    ]
    rationale: str = Field(min_length=1, max_length=350)
    uncertainty: Literal["clear", "review required", "ambiguous"]
    user_check: str = Field(min_length=1, max_length=350)


class Mapping(Strict):
    suggestions: list[Column] = Field(min_length=1, max_length=60)
    warnings: list[str] = Field(max_length=8)


class Answer(Strict):
    answer: str = Field(min_length=1, max_length=1200)
    metric_ids: list[str] = Field(max_length=20)
    source_ids: list[str] = Field(max_length=20)
    building_ids: list[str] = Field(max_length=20)
    unsupported: bool


def prose(value):
    """Numbers must come from metric IDs or verified source quotes, never model prose."""
    if re.search(r"\d", value) or re.search(
        r"\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred|thousand)\s+(?:percent|per cent|kwh|mwh|eur|euros|degrees)\b",
        value,
        re.I,
    ):
        raise ValueError("Model-authored number rejected")
    if re.search(
        r"\b(guarantee\w*|definitely|certainly|proven|diagnos\w*|caused by|will save|confidence score)\b",
        value,
        re.I,
    ):
        raise ValueError("Unsupported certainty rejected")


def validate_output(feature, value, pack=None, headers=None):
    schema = {"explanation": Explanation, "task_draft": Draft, "mapping": Mapping, "assistant": Answer}[
        feature
    ]
    obj = schema.model_validate(value).model_dump()
    if feature == "mapping":
        seen = set()
        targets = set()
        for item in obj["suggestions"]:
            column, target = item["source_column"], item["target_field"]
            if column not in headers or column in seen:
                raise ValueError("Unknown or duplicate source column")
            seen.add(column)
            if target != "unmapped" and target in targets:
                raise ValueError("Duplicate target field")
            targets.add(target)
            if target == "heat_consumption" and re.search(
                r"(amount|invoice|bill|cost|price|eur|currency|total.?due|vat|reading|cumulat)", column, re.I
            ):
                raise ValueError("Money/cumulative column cannot become consumption")
            prose(item["rationale"])
            prose(item["user_check"])
        for warning in obj["warnings"]:
            prose(warning)
        return obj
    metrics = set(pack["metrics"])
    sources = {x["id"] for x in pack["sources"]}

    def references(point):
        if not set(point["metric_ids"]) <= metrics or not set(point["source_ids"]) <= sources:
            raise ValueError("Unknown evidence reference")

    if feature == "explanation":
        for points in obj.values():
            for point in points:
                prose(point["text"])
                references(point)
        missing = any(
            pack["metrics"][metric]["value"] is None
            for point in obj["observations"]
            for metric in point["metric_ids"]
        )
        if missing and not obj["missing_information"]:
            raise ValueError("Unavailable observation metrics require missing-information disclosure")
        deviation = pack["metrics"].get("deviation", {}).get("value")
        for point in obj["observations"]:
            if deviation is not None:
                if deviation > 0 and re.search(
                    r"\b(below|lower than|less than) (?:the )?(expected|reference)", point["text"], re.I
                ):
                    raise ValueError("Observation contradicts the engine direction")
                if deviation < 0 and re.search(
                    r"\b(above|higher than|more than) (?:the )?(expected|reference)", point["text"], re.I
                ):
                    raise ValueError("Observation contradicts the engine direction")
        if not any(p["metric_ids"] for p in obj["observations"]):
            raise ValueError("Observation needs a backend metric")
    elif feature == "task_draft":
        references(obj)
        for key in ("title", "evidence_summary", "suggested_role"):
            prose(obj[key])
        for check in obj["checks"]:
            prose(check["action"])
            prose(check["question"])
        for text in obj["missing_information"] + obj["closure_records"]:
            prose(text)
    else:
        prose(obj["answer"])
        references(obj)
        if not set(obj["building_ids"]) <= set(pack.get("building_ids", [])):
            raise ValueError("Unknown building reference")
        if not obj["unsupported"] and not obj["source_ids"]:
            raise ValueError("Answer needs evidence")
    return obj
