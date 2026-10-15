import copy
import pytest
from apps.api.analysis import validate, analyze, fit_reference, number
from apps.api.synthetic import generate
from apps.api.imports import read_upload, safe_cell


@pytest.fixture
def data():
    return generate()


def result(data, bid):
    b = next(b for b in data["buildings"] if b["id"] == bid)
    return analyze(b, [r for r in data["records"] if r["building_external_id"] == bid], data["weather"])


def test_independent_conversion_and_period(data):
    row = dict(
        data["raw"][0],
        heat_consumption="1,25",
        heat_unit="MWh",
        heated_area_m2=50,
        period_start="2024-02-01",
        period_end="2024-02-29",
    )
    rows, errors = validate([row])
    assert not errors
    assert rows[0]["heat_kwh"] == 1250
    assert rows[0]["heat_kwh"] / rows[0]["heated_area_m2"] == 25
    assert rows[0]["days"] == 29


@pytest.mark.parametrize(
    "field,value",
    [
        ("heat_unit", "m3"),
        ("heat_unit", "EUR"),
        ("heat_consumption", -1),
        ("heat_consumption", "NaN"),
        ("heated_area_m2", 0),
        ("measurement_type", "cumulative"),
        ("period_start", "01/02/2024"),
        ("period_end", "2024-01-20"),
        ("includes_dhw", "maybe"),
    ],
)
def test_bad_input_is_not_guessed(data, field, value):
    clean, issues = validate([dict(data["raw"][0], **{field: value})])
    assert not clean and issues


def test_cold_weather_and_persistent_change(data):
    cold = result(data, "SYN-002")
    assert cold["status"] == "within reference" and abs(cold["deviation"]) < 0.03
    assert cold["trace"][24]["heat_kwh"] > cold["trace"][12]["heat_kwh"]
    anomaly = result(data, "SYN-003")
    assert anomaly["status"] == "investigate" and anomaly["deviation"] > 0.4
    assert len(anomaly["flagged_months"]) >= 2


def test_missing_duplicates_meter_change_and_zero_hdd(data):
    assert result(data, "SYN-004")["status"] == "data review"
    assert result(data, "SYN-006")["status"] == "insufficient data"
    assert any("Duplicate" in e["message"] for e in data["issues"])
    r = result(data, "SYN-001")
    july = next(t for t in r["trace"] if t["period_start"] == "2026-07-01")
    assert july["hdd"] == 0 and july["expected_kwh"] > 0 and not july["flagged"]


def test_training_never_uses_evaluation(data):
    original = result(data, "SYN-003")
    altered = copy.deepcopy(data)
    for row in altered["records"]:
        if row["period_start"] >= "2026-01-01":
            row["heat_kwh"] *= 10
    assert result(altered, "SYN-003")["model"] == original["model"]
    assert original["model"]["training_end"] < "2026-01-01"


def test_independent_reference_coefficients():
    # Hand-built response: 100 kWh/day + 20 kWh/HDD, independent of generator.
    rows = []
    for year in (2024, 2025):
        for month in range(1, 13):
            hdd = (month - 1) * 50
            rows.append(
                dict(
                    days=30,
                    hdd=hdd,
                    heat_kwh=3000 + 20 * hdd,
                    period_start=f"{year}-{month:02}-01",
                    period_end=f"{year}-{month:02}-28",
                )
            )
    m = fit_reference(rows)
    assert m["base_kwh_day"] == pytest.approx(100)
    assert m["heating_kwh_hdd"] == pytest.approx(20)
    assert fit_reference(rows[:12]) is None


def test_seed_reproducible_and_labels_separate():
    assert generate() == generate()
    assert not any("scenario" in r or "label" in r for r in generate()["records"])


def test_duplicate_area_and_overlap(data):
    row = data["raw"][0]
    assert len(validate([row, row])[1]) == 1
    assert (
        len(
            validate(
                [row, dict(row, period_start="2024-02-01", period_end="2024-02-29", heated_area_m2=100)]
            )[1]
        )
        == 1
    )


@pytest.mark.parametrize("value", ['=HYPERLINK("bad")', "+1", "-1", "@SUM(A1)", "  =1"])
def test_csv_injection(value):
    assert safe_cell(value).startswith("'")


def test_upload_limits_and_unsafe_xlsx():
    with pytest.raises(ValueError):
        read_upload("x.csv", b"x" * 2_000_001)
    with pytest.raises(ValueError):
        read_upload("x.xlsm", b"")
    from openpyxl import Workbook
    import io

    wb = Workbook()
    ws = wb.active
    ws.append(["building_external_id"])
    ws.append(["=1+1"])
    out = io.BytesIO()
    wb.save(out)
    with pytest.raises(ValueError, match="Formula"):
        read_upload("x.xlsx", out.getvalue())


def test_semicolon_and_decimal_comma():
    content = b"building_external_id;period_start;period_end;heat_consumption;heat_unit;heated_area_m2;measurement_type;includes_dhw\nX;2026-01-01;2026-01-31;1,25;MWh;50;consumption;true\n"
    parsed = read_upload("x.csv", content)
    assert not parsed["issues"]
    assert parsed["records"][0]["heat_kwh"] == 1250


def test_number_infinity():
    with pytest.raises(ValueError):
        number("inf")


def test_nonadjacent_flags_do_not_trigger_persistence(data):
    for row in data["records"]:
        if (
            row["building_external_id"] == "SYN-003"
            and row["period_start"] >= "2026-01-01"
            and row["period_start"] not in ("2026-01-01", "2026-03-01")
        ):
            row["heat_kwh"] /= 1.45
    r = result(data, "SYN-003")
    assert r["flagged_months"] == ["2026-01-01", "2026-03-01"]
    assert r["status"] == "within reference"


def test_zero_reference_is_safe(data):
    for row in data["records"]:
        if row["building_external_id"] == "SYN-001":
            row["heat_kwh"] = 0
    r = result(data, "SYN-001")
    assert r["deviation"] is None and r["priority"] == 0
    assert all(t["deviation"] is None for t in r["trace"])


def test_xlsx_values_and_zip_limits(data):
    import io
    import zipfile
    from openpyxl import Workbook

    wb = Workbook()
    keys = list(data["raw"][0])
    wb.active.append(keys)
    wb.active.append(list(data["raw"][0].values()))
    out = io.BytesIO()
    wb.save(out)
    assert not read_upload("safe.xlsx", out.getvalue())["issues"]
    for member, content in [
        ("../outside.xml", "x"),
        ("large.xml", "a" * 20_000_001),
        ("xl/vbaProject.bin", "x"),
        ("xl/externalLinks/link.xml", "x"),
    ]:
        out = io.BytesIO()
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr(member, content)
        with pytest.raises(ValueError):
            read_upload("unsafe.xlsx", out.getvalue())


def test_row_limit():
    with pytest.raises(ValueError, match="10,000"):
        read_upload("large.csv", b"id\n" + b"x\n" * 10001)
