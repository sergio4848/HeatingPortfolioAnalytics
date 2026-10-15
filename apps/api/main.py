import csv
import hashlib
import io
import json
import logging
import os
import secrets
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone, date
from pathlib import Path
from typing import Literal
from uuid import uuid4
import jwt
from fastapi import FastAPI, Depends, HTTPException, Request, Response, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from itsdangerous import URLSafeTimedSerializer, BadSignature
from pydantic import BaseModel, Field, ConfigDict, model_validator
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from reportlab.pdfgen import canvas
from .db import engine, Entity, seed, get, put, all_items
from .analysis import analyze, VERSION, DISCLOSURE
from .imports import read_upload, safe_cell, MAX_BYTES
from .body_limit import BodyLimit

ROOT = Path(__file__).resolve().parents[2]
MODE = os.getenv("APP_MODE", "demo")
REQUEST_LOG = logging.getLogger("portotherm.requests")
if not REQUEST_LOG.handlers:
    REQUEST_LOG.addHandler(logging.StreamHandler())
REQUEST_LOG.setLevel(logging.INFO)
REQUEST_LOG.propagate = False
SIGNER = URLSafeTimedSerializer(os.getenv("SESSION_SECRET") or secrets.token_hex(32))
ORIGINS = set(
    os.getenv(
        "TRUSTED_ORIGINS",
        "http://127.0.0.1:8000,http://localhost:8000,http://127.0.0.1:5173,http://localhost:5173,http://testserver",
    ).split(",")
)


@asynccontextmanager
async def lifespan(app):
    # Schema is provisioned by Alembic. Never silently create tables on production startup.
    if MODE == "demo":
        seed()
    yield


app = FastAPI(
    title="Portotherm API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)


@app.middleware("http")
async def guard(request: Request, call_next):
    started = time.monotonic()
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        origin = request.headers.get("origin")
        if origin and origin not in ORIGINS:
            return Response(status_code=403)
        if request.headers.get("sec-fetch-site") == "cross-site":
            return Response(status_code=403)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Frame-Options"] = "DENY"
    route = request.scope.get("route")
    REQUEST_LOG.info(
        json.dumps(
            {
                "event": "request.completed",
                "method": request.method,
                "route": getattr(route, "path", "static-or-unmatched"),
                "status": response.status_code,
                "elapsed_ms": round((time.monotonic() - started) * 1000),
            }
        )
    )
    return response


def db():
    with Session(engine) as s:
        yield s


def pilot_context(request, s):
    issuer, audience, jwks_url = [os.getenv(x) for x in ("OIDC_ISSUER", "OIDC_AUDIENCE", "OIDC_JWKS_URL")]
    if not all((issuer, audience, jwks_url)):
        raise HTTPException(503, "Pilot identity provider is not configured")
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Verified identity required")
    try:
        token = auth[7:]
        key = jwt.PyJWKClient(jwks_url).get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=audience,
            issuer=issuer,
            options={"require": ["exp", "sub", "iss", "aud"]},
        )
    except Exception:
        raise HTTPException(401, "Invalid identity token") from None
    # Active tenant comes from a verified membership record, never a request parameter.
    memberships = [
        e for e in s.scalars(select(Entity).where(Entity.kind == "Membership", Entity.id == claims["sub"]))
    ]
    if len(memberships) != 1:
        raise HTTPException(403, "An administrator must provision exactly one active organization membership")
    m = memberships[0]
    return {"tenant": m.tenant, "role": m.data["role"], "subject": claims["sub"], "data_type": "pilot"}


def context(request: Request, s: Session = Depends(db)):
    if MODE == "pilot":
        return pilot_context(request, s)
    if MODE != "demo":
        raise HTTPException(503, "Unknown application mode")
    try:
        tenant = SIGNER.loads(request.cookies.get("demo_session", ""), max_age=28800)
        if not get(s, tenant, "Organization", tenant):
            raise BadSignature("Session expired")
        return {"tenant": tenant, "role": "admin", "subject": "demo-analyst", "data_type": "synthetic"}
    except BadSignature:
        raise HTTPException(401, "Start a local demo session") from None


def writer(c=Depends(context)):
    if c["role"] not in ("admin", "analyst"):
        raise HTTPException(403, "Analyst or admin role required")
    return c


def audit(s, c, action, details):
    id = str(uuid4())
    put(
        s,
        c["tenant"],
        "AuditEvent",
        id,
        dict(
            id=id,
            at=datetime.now(timezone.utc).isoformat(),
            actor=c["subject"],
            action=action,
            details=details,
        ),
    )


def clone_demo(s, tenant):
    for kind in (
        "Organization",
        "Building",
        "ConsumptionRecord",
        "WeatherRecord",
        "Intervention",
        "ImportBatch",
    ):
        for e in s.scalars(select(Entity).where(Entity.tenant == "demo", Entity.kind == kind)):
            id = tenant if kind == "Organization" else e.id
            put(s, tenant, kind, id, dict(e.data, id=tenant) if kind == "Organization" else e.data)
    s.commit()


@app.post("/api/session")
def start_session(request: Request, response: Response, s: Session = Depends(db)):
    if MODE == "pilot":
        return pilot_context(request, s)
    if MODE != "demo":
        raise HTTPException(503, "Unknown mode")
    # Local-only demo configuration. Do not expose this service to a public interface.
    tenant = "demo-" + uuid4().hex
    clone_demo(s, tenant)
    response.set_cookie(
        "demo_session",
        SIGNER.dumps(tenant),
        httponly=True,
        samesite="strict",
        max_age=28800,
        secure=os.getenv("COOKIE_SECURE", "false") == "true",
    )
    return dict(tenant=tenant, role="admin", data_type="synthetic", disclosure=DISCLOSURE)


@app.get("/api/session")
def session(c=Depends(context)):
    return c


@app.get("/api/health")
def health(s: Session = Depends(db)):
    s.execute(select(Entity.id).limit(1))
    return {"status": "ok", "mode": MODE, "method": VERSION}


def results(s, c, start, end):
    org = get(s, c["tenant"], "Organization", c["tenant"])
    weather = {w["period_start"]: w for w in all_items(s, c["tenant"], "WeatherRecord")}
    records = all_items(s, c["tenant"], "ConsumptionRecord")
    return sorted(
        [
            analyze(
                b,
                [r for r in records if r["building_external_id"] == b["id"]],
                weather,
                start,
                end,
                org["threshold"],
            )
            for b in all_items(s, c["tenant"], "Building")
        ],
        key=lambda b: (-b["priority"], b["id"]),
    )


def dates(start, end):
    try:
        a, b = date.fromisoformat(start), date.fromisoformat(end)
        if a > b:
            raise ValueError()
    except ValueError:
        raise HTTPException(422, "Use an ordered ISO date range") from None


@app.get("/api/portfolio")
def portfolio(
    start: str = "2026-01-01",
    end: str = "2026-09-30",
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    c=Depends(context),
    s: Session = Depends(db),
):
    dates(start, end)
    data = results(s, c, start, end)
    return {
        "items": data[offset : offset + limit],
        "total": len(data),
        "method": VERSION,
        "data_type": c["data_type"],
        "disclosure": DISCLOSURE if c["data_type"] == "synthetic" else "Pilot data — human review required",
        "organization": get(s, c["tenant"], "Organization", c["tenant"]),
        "tasks": all_items(s, c["tenant"], "Task"),
        "interventions": all_items(s, c["tenant"], "Intervention"),
    }


@app.get("/api/buildings/{bid}")
def building(bid: str, c=Depends(context), s: Session = Depends(db)):
    if not get(s, c["tenant"], "Building", bid):
        raise HTTPException(404, "Building not found")
    return next(b for b in results(s, c, "2026-01-01", "2026-09-30") if b["id"] == bid)


class TaskIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    building_id: str = Field(max_length=80)
    status: Literal["new", "reviewing", "action planned", "monitoring", "closed"] = "new"
    assignee: str = Field(default="Demo analyst role", max_length=100)
    note: str = Field(default="", max_length=2000)
    technical_action: str = Field(default="Check meter and invoice records", max_length=2000)
    priority: Literal["low", "medium", "high"] = "medium"
    due: date | None = None


@app.post("/api/tasks", status_code=201)
def create_task(body: TaskIn, c=Depends(writer), s: Session = Depends(db)):
    if not get(s, c["tenant"], "Building", body.building_id):
        raise HTTPException(404, "Building not found")
    id = str(uuid4())
    task = dict(
        body.model_dump(mode="json"),
        id=id,
        history=[dict(at=datetime.now(timezone.utc).isoformat(), status=body.status, note=body.note)],
    )
    put(s, c["tenant"], "Task", id, task)
    put(
        s,
        c["tenant"],
        "Finding",
        id,
        dict(id=id, building_id=body.building_id, status=body.status, method=VERSION),
    )
    audit(s, c, "task.created", {"task_id": id})
    s.commit()
    return task


@app.put("/api/tasks/{id}")
def update_task(id: str, body: TaskIn, c=Depends(writer), s: Session = Depends(db)):
    task = get(s, c["tenant"], "Task", id)
    if not task or task["building_id"] != body.building_id:
        raise HTTPException(404, "Task not found")
    task = dict(
        body.model_dump(mode="json"),
        id=id,
        history=task["history"]
        + [dict(at=datetime.now(timezone.utc).isoformat(), status=body.status, note=body.note)],
    )
    put(s, c["tenant"], "Task", id, task)
    put(
        s,
        c["tenant"],
        "Finding",
        id,
        dict(id=id, building_id=body.building_id, status=body.status, method=VERSION),
    )
    audit(s, c, "task.updated", {"task_id": id, "status": body.status})
    s.commit()
    return task


class InterventionIn(BaseModel):
    building_id: str
    kind: str = Field(min_length=1, max_length=100)
    start: date
    end: date
    scope: str = Field(max_length=2000)
    expected_effect: str = Field(max_length=1000)
    cost: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    cost_source: str = Field(default="", max_length=300)
    notes: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def ordered(self):
        if self.end < self.start or (self.cost is not None and not self.cost_source):
            raise ValueError("Ordered dates and a source for any cost are required")
        return self


@app.post("/api/interventions", status_code=201)
def intervention(body: InterventionIn, c=Depends(writer), s: Session = Depends(db)):
    if not get(s, c["tenant"], "Building", body.building_id):
        raise HTTPException(404, "Building not found")
    id = str(uuid4())
    data = dict(body.model_dump(mode="json"), id=id)
    put(s, c["tenant"], "Intervention", id, data)
    audit(s, c, "intervention.created", {"id": id})
    s.commit()
    return data


@app.get("/api/template.csv")
def template():
    return FileResponse(
        ROOT / "data/templates/consumption.csv", media_type="text/csv", filename="portotherm-template.csv"
    )


@app.get("/api/template.xlsx")
def xlsx_template():
    return FileResponse(
        ROOT / "data/templates/consumption.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="portotherm-template.xlsx",
    )


@app.post("/api/imports/preview")
async def preview(
    file: UploadFile = File(...), mapping: str = Form("{}"), c=Depends(writer), s: Session = Depends(db)
):
    if Path(file.filename or "").suffix.lower() not in (".csv", ".xlsx"):
        raise HTTPException(415, "Only CSV and macro-free XLSX files are supported")
    content = await file.read(MAX_BYTES + 1)
    if len(content) > MAX_BYTES:
        raise HTTPException(413, "File limit is 2 MB")
    if file.content_type not in (
        "text/csv",
        "application/csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/octet-stream",
    ):
        raise HTTPException(415, "Unsupported content type")
    try:
        parsed = read_upload(file.filename or "", content, mapping)
    except Exception as exc:
        raise HTTPException(
            422, str(exc)[:300] if isinstance(exc, ValueError) else "Unreadable or unsafe file"
        ) from None
    existing = {
        (r["building_external_id"], r["period_start"]) for r in all_items(s, c["tenant"], "ConsumptionRecord")
    }
    buildings = {b["id"]: b for b in all_items(s, c["tenant"], "Building")}
    conflicts = []
    for row in parsed["records"]:
        if (row["building_external_id"], row["period_start"]) in existing:
            conflicts.append(f"{row['building_external_id']} / {row['period_start']}")
        b = buildings.get(row["building_external_id"])
        if b and b["heated_area_m2"] != row["heated_area_m2"]:
            parsed["issues"].append(
                {
                    "row": "building",
                    "building": b["id"],
                    "message": "Area differs from existing building; import blocked",
                }
            )
    id = str(uuid4())
    data = dict(
        parsed, id=id, sha256=hashlib.sha256(content).hexdigest(), conflicts=conflicts, status="preview"
    )
    put(s, c["tenant"], "ImportBatch", id, data)
    audit(s, c, "import.preview", {"batch_id": id, "rows": parsed["total_rows"]})
    s.commit()
    return {k: v for k, v in data.items() if k != "records"}


class CommitIn(BaseModel):
    policy: Literal["reject", "skip"] = "reject"


@app.post("/api/imports/{id}/commit")
def commit(id: str, body: CommitIn, c=Depends(writer), s: Session = Depends(db)):
    batch = get(s, c["tenant"], "ImportBatch", id)
    if not batch:
        raise HTTPException(404, "Import not found")
    if batch["status"] == "committed":
        raise HTTPException(409, "Batch already committed")
    if batch["issues"]:
        raise HTTPException(422, "Correct all reported errors before import; no rows silently discarded")
    existing = {
        (r["building_external_id"], r["period_start"]) for r in all_items(s, c["tenant"], "ConsumptionRecord")
    }
    conflicts = [r for r in batch["records"] if (r["building_external_id"], r["period_start"]) in existing]
    if conflicts and body.policy == "reject":
        raise HTTPException(
            409, "Existing building/month records detected. Choose explicit skip or correct source"
        )
    written = 0
    for row in batch["records"]:
        bid = row["building_external_id"]
        if (bid, row["period_start"]) in existing:
            continue
        if not get(s, c["tenant"], "Building", bid):
            put(
                s,
                c["tenant"],
                "Building",
                bid,
                dict(
                    id=bid,
                    name=bid,
                    heated_area_m2=row["heated_area_m2"],
                    building_type="Unknown",
                    quality_issues=["Imported data: verify weather/location match before model use"],
                ),
            )
        put(s, c["tenant"], "ConsumptionRecord", f"{bid}:{row['period_start']}", row)
        existing.add((bid, row["period_start"]))
        written += 1
    # Imported customer records must never inherit synthetic weather.
    # In local demo all data is labelled synthetic; imported buildings remain quality-flagged.
    batch = dict(batch, status="committed", written=written, skipped=len(conflicts))
    put(s, c["tenant"], "ImportBatch", id, batch)
    audit(
        s,
        c,
        "import.committed",
        {"batch_id": id, "written": written, "skipped": len(conflicts), "policy": body.policy},
    )
    run_id = str(uuid4())
    put(
        s,
        c["tenant"],
        "AnalysisRun",
        run_id,
        dict(id=run_id, method=VERSION, batch_id=id, at=datetime.now(timezone.utc).isoformat()),
    )
    s.commit()
    return {"written": written, "skipped": len(conflicts), "analysis_run": run_id}


class SettingsIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    threshold: float = Field(ge=0.1, le=0.8, allow_inf_nan=False)
    unit: Literal["kWh"] = "kWh"


@app.put("/api/settings")
def settings(body: SettingsIn, c=Depends(writer), s: Session = Depends(db)):
    if c["role"] != "admin":
        raise HTTPException(403, "Admin required")
    before = get(s, c["tenant"], "Organization", c["tenant"])
    data = dict(before, **body.model_dump())
    put(s, c["tenant"], "Organization", c["tenant"], data)
    audit(s, c, "settings.changed", {"before": before, "after": data})
    s.commit()
    return data


@app.get("/api/audit")
def audits(
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    c=Depends(context),
    s: Session = Depends(db),
):
    return all_items(s, c["tenant"], "AuditEvent")[offset : offset + limit]


@app.post("/api/reset")
def reset(c=Depends(writer), s: Session = Depends(db)):
    if MODE != "demo" or not c["tenant"].startswith("demo-"):
        raise HTTPException(403, "Reset only available in isolated demo sessions")
    s.execute(delete(Entity).where(Entity.tenant == c["tenant"]))
    s.commit()
    clone_demo(s, c["tenant"])
    return {"status": "reset"}


def report_data(s, c, start, end, bid, quality, kind, status):
    dates(start, end)
    data = results(s, c, start, end)
    if bid:
        if not get(s, c["tenant"], "Building", bid):
            raise HTTPException(404, "Building not found")
        data = [b for b in data if b["id"] == bid]
    return [
        b
        for b in data
        if (not quality or b["quality"] == quality)
        and (not kind or b["building_type"] == kind)
        and (not status or b["status"] == status)
    ]


@app.get("/api/reports/{format}")
def report(
    format: Literal["csv", "pdf"],
    start: str = "2026-01-01",
    end: str = "2026-09-30",
    bid: str = "",
    quality: str = "",
    kind: str = "",
    status: str = "",
    c=Depends(context),
    s: Session = Depends(db),
):
    data = report_data(s, c, start, end, bid, quality, kind, status)
    disclosure = DISCLOSURE if c["data_type"] == "synthetic" else "Pilot data — human review required"
    generated = datetime.now(timezone.utc).isoformat()
    if format == "csv":
        stream = io.StringIO(newline="")
        w = csv.writer(stream)
        w.writerow(
            [
                "disclosure",
                "generated_utc",
                "method",
                "period_start",
                "period_end",
                "building",
                "status",
                "quality",
                "observed_kwh",
                "expected_kwh",
                "residual_kwh",
                "priority",
                "reason",
                "limitations",
            ]
        )
        if not data:
            w.writerow(
                [
                    disclosure,
                    generated,
                    VERSION,
                    start,
                    end,
                    "",
                    "No buildings match filters",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "Human review required; no finding or savings claim.",
                ]
            )
        for b in data:
            w.writerow(
                [
                    safe_cell(v)
                    for v in (
                        disclosure,
                        generated,
                        VERSION,
                        start,
                        end,
                        b["id"],
                        b["status"],
                        b["quality"],
                        round(b["observed_kwh"], 2),
                        round(b["expected_kwh"], 2) if b["expected_kwh"] is not None else "",
                        round(b["residual_kwh"], 2) if b["residual_kwh"] is not None else "",
                        b["priority"],
                        b["reason"],
                        " ".join(b["limitations"]),
                    )
                ]
            )
        output = stream.getvalue().encode("utf-8-sig")
        media = "text/csv"
    else:
        stream = io.BytesIO()
        pdf = canvas.Canvas(stream, pagesize=(595, 842))
        pdf.setTitle("Portotherm evidence report")

        def page_header():
            pdf.setFillColorRGB(0.08, 0.17, 0.24)
            pdf.setFont("Helvetica-Bold", 22)
            pdf.drawString(42, 795, "Portotherm / Review evidence")
            pdf.setFont("Helvetica", 9)
            pdf.drawString(42, 771, disclosure.replace("—", "-"))
            pdf.drawString(42, 755, f"{start} to {end} / {VERSION}")
            pdf.drawString(42, 740, f"Generated UTC: {generated}")

        page_header()
        y = 705
        import textwrap

        for b in data:
            lines = [
                f"{b['id']} / {b['name']} / {b['status']}",
                f"Observed {b['observed_kwh']:,.0f} kWh; expected "
                + (f"{b['expected_kwh']:,.0f} kWh" if b["expected_kwh"] is not None else "insufficient data"),
                f"Quality: {b['quality']}; review priority: {b['priority']}/100",
                b["reason"],
                "Training: "
                + (
                    f"{b['model']['training_start']} to {b['model']['training_end']}"
                    if b["model"]
                    else "Insufficient history"
                ),
                "Limitations: " + " ".join(b["limitations"]),
                "Human review: check invoices, use changes, meter history and maintenance records.",
            ]
            wrapped = [part for line in lines for part in textwrap.wrap(line, 95)]
            if y - len(wrapped) * 13 < 70:
                pdf.showPage()
                page_header()
                y = 705
            for line in wrapped:
                pdf.setFont("Helvetica", 10)
                pdf.drawString(42, y, line.replace("—", "-").replace("≈", "~"))
                y -= 13
            y -= 22
        pdf.save()
        output = stream.getvalue()
        media = "application/pdf"
    return StreamingResponse(
        io.BytesIO(output),
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="portotherm-evidence.{format}"'},
    )


app.add_middleware(BodyLimit)

dist = ROOT / "apps/web/dist"
if dist.exists():
    app.mount("/", StaticFiles(directory=dist, html=True), name="web")
