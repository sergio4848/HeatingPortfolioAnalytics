import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from apps.api import main, db


@pytest.fixture
def client(tmp_path, monkeypatch):
    engine = create_engine(
        "sqlite:///" + str(tmp_path / "test.db"), connect_args={"check_same_thread": False}
    )
    db.Base.metadata.create_all(engine)
    monkeypatch.setattr(db, "engine", engine)
    monkeypatch.setattr(main, "engine", engine)
    monkeypatch.setattr(main, "MODE", "demo")
    with TestClient(main.app) as c:
        assert c.post("/api/session").status_code == 200
        yield c


def task_body():
    return {
        "building_id": "SYN-003",
        "note": "Inspect invoice period",
        "technical_action": "Check meter",
        "priority": "high",
    }


def test_full_api_journey_and_tenant_isolation(client):
    p = client.get("/api/portfolio").json()
    assert p["total"] == 12 and p["items"][0]["id"] == "SYN-003"
    assert client.get("/api/buildings/SYN-003").status_code == 200
    response = client.post("/api/tasks", json=task_body())
    assert response.status_code == 201
    task = response.json()
    body = dict(task_body(), status="reviewing")
    assert len(client.put("/api/tasks/" + task["id"], json=body).json()["history"]) == 2
    for kind in ("csv", "pdf"):
        r = client.get("/api/reports/" + kind)
        assert r.status_code == 200
        if kind == "pdf":
            from pypdf import PdfReader

            text = "".join(p.extract_text() for p in PdfReader(io.BytesIO(r.content)).pages)
            assert "Synthetic demo data" in text and "monthly-nnls-1.0" in text
        else:
            assert "Synthetic demo data" in r.text
    original = client.cookies.get("demo_session")
    client.post("/api/session")
    assert not client.get("/api/portfolio").json()["tasks"]
    assert client.put("/api/tasks/" + task["id"], json=body).status_code == 404
    assert client.get("/api/reports/pdf?bid=OTHER-TENANT").status_code == 404
    client.cookies.set("demo_session", original)
    assert client.get("/api/portfolio").status_code in (200, 401)


def test_no_session_and_csrf(client):
    client.cookies.clear()
    assert client.get("/api/portfolio").status_code == 401
    assert client.get("/api/reports/pdf").status_code == 401
    assert client.post("/api/session", headers={"Origin": "https://hostile.example"}).status_code == 403


def test_import_preview_commit_duplicate_and_mapping(client):
    file = main.ROOT / "data/templates/consumption.csv"
    preview = client.post(
        "/api/imports/preview", files={"file": ("test.csv", file.read_bytes(), "text/csv")}
    ).json()
    assert not preview["issues"]
    response = client.post("/api/imports/" + preview["id"] + "/commit", json={"policy": "reject"})
    assert response.status_code == 200 and response.json()["written"] == 1
    assert (
        client.post("/api/imports/" + preview["id"] + "/commit", json={"policy": "skip"}).status_code == 409
    )
    p = client.post(
        "/api/imports/preview", files={"file": ("test.csv", file.read_bytes(), "text/csv")}
    ).json()
    assert p["conflicts"]
    assert client.post("/api/imports/" + p["id"] + "/commit", json={"policy": "reject"}).status_code == 409
    r = client.post("/api/imports/" + p["id"] + "/commit", json={"policy": "skip"}).json()
    assert r["written"] == 0 and r["skipped"] == 1
    # Mapped header actually reaches validation.
    content = file.read_text().replace("heat_consumption", "energy")
    p = client.post(
        "/api/imports/preview",
        files={"file": ("x.csv", content, "text/csv")},
        data={"mapping": '{"energy":"heat_consumption"}'},
    ).json()
    assert not p["issues"]


def test_invalid_files(client):
    assert client.post("/api/imports/preview", files={"file": ("x.xlsm", b"bad")}).status_code == 415
    assert (
        client.post("/api/imports/preview", files={"file": ("x.csv", b"bad", "application/pdf")}).status_code
        == 415
    )
    assert (
        client.post(
            "/api/imports/preview", files={"file": ("x.csv", b"a" * 2_000_100, "text/csv")}
        ).status_code
        == 413
    )


def test_viewer_cannot_mutate_and_pilot_fails_closed(client, monkeypatch):
    main.app.dependency_overrides[main.context] = lambda: {
        "tenant": "nonexistent",
        "role": "viewer",
        "subject": "x",
        "data_type": "pilot",
    }
    try:
        assert client.post("/api/tasks", json=task_body()).status_code == 403
        assert client.put("/api/settings", json={"name": "x", "threshold": 0.2}).status_code == 403
    finally:
        main.app.dependency_overrides.clear()
    monkeypatch.setattr(main, "MODE", "pilot")
    assert client.get("/api/portfolio").status_code == 503
    assert client.get("/api/reports/pdf").status_code == 503
    monkeypatch.setenv("OIDC_ISSUER", "https://issuer.invalid")
    monkeypatch.setenv("OIDC_AUDIENCE", "portfolio")
    monkeypatch.setenv("OIDC_JWKS_URL", "https://issuer.invalid/keys")
    assert client.get("/api/portfolio").status_code == 401
    assert client.post("/api/reset").status_code == 401


def test_audit_and_filters(client):
    assert (
        client.put(
            "/api/settings", json={"name": "Demo changed", "threshold": 0.25, "unit": "kWh"}
        ).status_code
        == 200
    )
    assert client.get("/api/audit").json()[0]["action"] == "settings.changed"
    r = client.get("/api/reports/csv?status=investigate")
    assert "SYN-003" in r.text and "SYN-001" not in r.text
    assert client.get("/api/portfolio?start=2026-09-01&end=2024-01-01").status_code == 422


def test_foreign_tenant_building_and_reports(client):
    with Session(main.engine) as s:
        db.put(s, "foreign", "Building", "PRIVATE-1", {"id": "PRIVATE-1"})
        s.commit()
    assert client.get("/api/buildings/PRIVATE-1").status_code == 404
    assert client.get("/api/reports/pdf?bid=PRIVATE-1").status_code == 404
    assert client.post("/api/tasks", json=dict(task_body(), building_id="PRIVATE-1")).status_code == 404


def test_empty_csv_keeps_disclosure_and_chunked_limit(client):
    response = client.get("/api/reports/csv?status=no-matching-buildings")
    assert "Synthetic demo data" in response.text
    # Explicitly omit Content-Length to exercise pre-parser byte accounting.
    response = client.post(
        "/api/imports/preview",
        content=iter([b"x" * 1_100_000, b"x" * 1_100_000]),
        headers={"Content-Type": "application/octet-stream"},
    )
    assert response.status_code == 413


def test_reset_is_scoped(client):
    client.post("/api/tasks", json=task_body())
    assert client.post("/api/reset").status_code == 200
    p = client.get("/api/portfolio").json()
    assert p["total"] == 12 and not p["tasks"]
    with Session(main.engine) as s:
        assert len(db.all_items(s, "demo", "Building")) == 12
