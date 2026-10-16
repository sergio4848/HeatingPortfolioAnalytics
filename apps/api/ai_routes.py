"""Authorized evidence, maintenance sources and opt-in Claude workflows."""

import io
import json
import re
import time
from datetime import date, datetime, timezone
from uuid import uuid4
import anthropic
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import Field
from pypdf import PdfReader
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError
from .db import Entity, get, put, all_items
from .ai_contracts import Strict, Mapping, Explanation, Draft, Answer, PROMPT_VERSION, validate_output
from .ai_evidence import digest, evidence, model_evidence
from .ai_provider import configuration, allowed, Invocation, SYSTEM, now


class AIInput(Strict):
    approved_data_transfer: bool = False
    start: str = "2026-01-01"
    end: str = "2026-09-30"


class MappingInput(AIInput):
    batch_id: str = Field(max_length=120)


class Question(AIInput):
    question: str = Field(min_length=3, max_length=600)


class AISettings(Strict):
    enabled: bool
    real_data_authorized: bool = False


class Note(Strict):
    title: str = Field(min_length=1, max_length=140)
    date: date
    source: str = Field(min_length=1, max_length=250)
    version: str = Field(default="1", min_length=1, max_length=30)
    text: str = Field(min_length=10, max_length=40000)


class Approval(Strict):
    confirmed: bool = False
    analysis_version: str = Field(max_length=64)
    title: str = Field(min_length=1, max_length=160)
    technical_action: str = Field(min_length=1, max_length=2000)
    note: str = Field(default="", max_length=2000)
    assignee: str = Field(min_length=1, max_length=100)
    priority: str = Field(default="medium", pattern="^(low|medium|high)$")
    due: date | None = None


class ToolArgs(Strict):
    building_id: str | None = Field(max_length=80)
    status: str | None = Field(max_length=40)
    quality: str | None = Field(max_length=40)
    query: str | None = Field(max_length=200)


def invalidate(s, tenant, bid):
    # Search reads current text directly. Purge every derived response for this building.
    for row in s.query(Entity).filter(Entity.tenant == tenant, Entity.kind == "AIResponse"):
        if row.data.get("building_id") == bid or row.data.get("feature") == "assistant":
            s.delete(row)


def checked_building(s, c, bid):
    if not get(s, c["tenant"], "Building", bid):
        raise HTTPException(404, "Building not found")


def document_search(s, c, bid, query=""):
    checked_building(s, c, bid)
    terms = re.findall(r"[\w-]+", query.lower())[:12]
    matches = []
    for doc in all_items(s, c["tenant"], "BuildingDocument"):
        if doc["building_id"] != bid:
            continue
        for page in doc["pages"]:
            score = sum(page["text"].lower().count(term) for term in terms)
            if not terms or score:
                matches.append(
                    {
                        "source_id": f"document:{doc['id']}:{page['page']}",
                        "document_id": doc["id"],
                        "title": doc["title"],
                        "date": doc["date"],
                        "version": doc["version"],
                        "page": page["page"],
                        "text": page["text"],
                        "score": score,
                    }
                )
    return sorted(matches, key=lambda x: (x["score"], x["date"]), reverse=True)[:6]


def create_router(db, context, writer, results, dates, audit):
    router = APIRouter(prefix="/api/ai", tags=["Evidence and Claude"])

    def rejected_request(s, c, feature, error):
        put(
            s,
            c["tenant"],
            "AIUsage",
            str(uuid4()),
            {
                "feature": feature,
                "model": configuration()["model"],
                "prompt_version": PROMPT_VERSION,
                "at": now(),
                "input_tokens": 0,
                "output_tokens": 0,
                "duration_ms": 0,
                "provider_calls": 0,
                "validation": "not_sent",
                "error": error,
                "estimated_cost_usd": 0,
                "cached": False,
                "cost_basis": "Request was blocked before provider submission; not a provider invoice.",
            },
        )
        s.commit()

    def authorize(s, c, consent, feature):
        try:
            return allowed(s, c, consent)
        except HTTPException as exc:
            rejected_request(s, c, feature, "HTTP" + str(exc.status_code))
            raise

    def invoke(s, c, cfg, feature):
        try:
            return Invocation(s, c, cfg)
        except HTTPException as exc:
            rejected_request(s, c, feature, "HTTP" + str(exc.status_code))
            raise

    def pack(s, c, bid, start, end):
        dates(start, end)
        return evidence(s, c, results, bid, start, end)

    @router.get("/status")
    def status(c=Depends(context), s=Depends(db)):
        cfg = configuration()
        org = get(s, c["tenant"], "Organization", c["tenant"])
        return {k: cfg[k] for k in ("model", "server_enabled", "provider_configured")} | {
            "organization_enabled": org.get("ai_enabled", False),
            "real_data_authorized": org.get("ai_real_data_allowed", False),
            "data_type": c["data_type"],
            "can_configure": c["role"] == "admin",
            "prompt_version": PROMPT_VERSION,
            "disclosure": "Only explicitly approved evidence, limited sample cells or selected document excerpts are sent to Anthropic. No raw file upload or external messaging.",
        }

    @router.put("/settings")
    def settings(body: AISettings, c=Depends(context), s=Depends(db)):
        if c["role"] != "admin":
            raise HTTPException(403, "Organization admin role required")
        org = get(s, c["tenant"], "Organization", c["tenant"])
        org = dict(org, ai_enabled=body.enabled, ai_real_data_allowed=body.real_data_authorized)
        put(s, c["tenant"], "Organization", c["tenant"], org)
        audit(
            s,
            c,
            "ai.settings.changed",
            {"enabled": body.enabled, "real_data_authorized": body.real_data_authorized},
        )
        s.commit()
        return status(c, s)

    @router.get("/buildings/{bid}/evidence")
    def get_evidence(
        bid: str, start: str = "2026-01-01", end: str = "2026-09-30", c=Depends(context), s=Depends(db)
    ):
        return pack(s, c, bid, start, end)

    @router.get("/buildings/{bid}/sources/{source_id}")
    def source(
        bid: str,
        source_id: str,
        start: str = "2026-01-01",
        end: str = "2026-09-30",
        c=Depends(context),
        s=Depends(db),
    ):
        entry = next((x for x in pack(s, c, bid, start, end)["sources"] if x["id"] == source_id), None)
        if not entry:
            raise HTTPException(404, "Source no longer available")
        return entry

    @router.get("/buildings/{bid}/documents")
    def documents(bid: str, c=Depends(context), s=Depends(db)):
        checked_building(s, c, bid)
        return [
            {k: v for k, v in x.items() if k != "pages"}
            for x in all_items(s, c["tenant"], "BuildingDocument")
            if x["building_id"] == bid
        ]

    def save_document(s, c, bid, metadata, pages):
        checked_building(s, c, bid)
        if len(documents(bid, c, s)) >= 10:
            raise HTTPException(413, "Building document limit is ten. Remove an obsolete document first.")
        id = str(uuid4())
        data = dict(
            metadata,
            id=id,
            building_id=bid,
            pages=pages,
            page_count=len(pages),
            created_at=now(),
            extraction="text only; no OCR",
            sha256=digest(pages),
        )
        put(s, c["tenant"], "BuildingDocument", id, data)
        invalidate(s, c["tenant"], bid)
        audit(s, c, "document.created", {"document_id": id, "building_id": bid, "page_count": len(pages)})
        s.commit()
        return {k: v for k, v in data.items() if k != "pages"}

    @router.post("/buildings/{bid}/documents/notes", status_code=201)
    def note(bid: str, body: Note, c=Depends(writer), s=Depends(db)):
        data = body.model_dump(mode="json")
        text = data.pop("text")
        return save_document(
            s, c, bid, data, [{"page": 1, "text": text, "start_char": 0, "end_char": len(text)}]
        )

    @router.post("/buildings/{bid}/documents/pdf", status_code=201)
    async def pdf(
        bid: str,
        file: UploadFile = File(...),
        title: str = Form(..., max_length=140),
        recorded_date: date = Form(...),
        source_name: str = Form(..., max_length=250),
        version: str = Form("1", max_length=30),
        c=Depends(writer),
        s=Depends(db),
    ):
        checked_building(s, c, bid)
        content = await file.read(2_000_001)
        if len(content) > 2_000_000:
            raise HTTPException(413, "Document limit is 2 MB")
        if not (file.filename or "").lower().endswith(".pdf") or not content.startswith(b"%PDF-"):
            raise HTTPException(415, "Upload a text-containing PDF")
        try:
            reader = PdfReader(io.BytesIO(content), strict=True)
            if reader.is_encrypted or len(reader.pages) > 30:
                raise ValueError("Unencrypted PDF of at most thirty pages required")
            pages = []
            offset = 0
            started = time.monotonic()
            for n, page in enumerate(reader.pages, 1):
                if time.monotonic() - started > 5:
                    raise ValueError("Extraction time limit exceeded")
                text = page.extract_text() or ""
                if offset + len(text) > 40000:
                    raise ValueError("Extracted text limit is forty thousand characters")
                pages.append({"page": n, "text": text, "start_char": offset, "end_char": offset + len(text)})
                offset += len(text)
            if not any(x["text"].strip() for x in pages):
                raise ValueError("No extractable text. Scanned invoices need OCR, which is not included.")
        except Exception:
            raise HTTPException(
                422,
                "PDF could not be read within the text/page limits. Encrypted or scanned PDFs are unsupported; no document was saved.",
            ) from None
        return save_document(
            s,
            c,
            bid,
            {"title": title, "date": recorded_date.isoformat(), "source": source_name, "version": version},
            pages,
        )

    @router.delete("/documents/{id}")
    def remove_document(id: str, c=Depends(writer), s=Depends(db)):
        doc = get(s, c["tenant"], "BuildingDocument", id)
        if not doc:
            raise HTTPException(404, "Document not found")
        s.execute(
            delete(Entity).where(
                Entity.tenant == c["tenant"], Entity.kind == "BuildingDocument", Entity.id == id
            )
        )
        invalidate(s, c["tenant"], doc["building_id"])
        audit(s, c, "document.deleted", {"document_id": id, "building_id": doc["building_id"]})
        s.commit()
        return {"deleted": True, "derived_cache_cleared": True}

    @router.get("/buildings/{bid}/documents/search")
    def search_documents(bid: str, q: str = "", c=Depends(context), s=Depends(db)):
        if len(q) > 200:
            raise HTTPException(422, "Search query limit is two hundred characters")
        return document_search(s, c, bid, q)

    def generate(feature, body, s, c, evidence_pack=None, batch=None):
        cfg = authorize(s, c, body.approved_data_transfer, feature)
        version = (
            evidence_pack["analysis_version"]
            if evidence_pack
            else digest({k: batch[k] for k in ("id", "headers", "preview")})
        )
        key = digest(
            {"feature": feature, "version": version, "model": cfg["model"], "prompt": PROMPT_VERSION}
        )
        cached = get(s, c["tenant"], "AIResponse", key)
        if (
            cached
            and (datetime.now(timezone.utc) - datetime.fromisoformat(cached["created_at"])).total_seconds()
            < 900
        ):
            metadata = dict(
                cached["usage"],
                at=now(),
                cached=True,
                input_tokens=0,
                output_tokens=0,
                provider_calls=0,
                duration_ms=0,
                estimated_cost_usd=0,
            )
            put(s, c["tenant"], "AIUsage", str(uuid4()), metadata)
            s.commit()
            return dict(cached, cached=True, current=True, usage=metadata)
        invocation = invoke(s, c, cfg, feature)
        try:
            schema = {"mapping": Mapping, "explanation": Explanation, "task_draft": Draft}[feature]
            data = (
                {"feature": feature, "evidence": model_evidence(evidence_pack)}
                if evidence_pack
                else {
                    "feature": feature,
                    "headers": batch["headers"],
                    "sample_rows": [
                        {str(k)[:120]: str(v)[:100] for k, v in row.items()} for row in batch["preview"][:3]
                    ],
                    "rules": "Only propose column mappings. Never infer missing units or equate money/cumulative readings with consumption. User review and normal parser validation follow.",
                }
            )
            output = validate_output(
                feature,
                invocation.structured(schema, data),
                evidence_pack,
                batch["headers"] if batch else None,
            )
            metadata = invocation.metadata(feature, True)
            response = {
                "id": key,
                "feature": feature,
                "mode": "live_claude",
                "created_at": now(),
                "model": cfg["model"],
                "prompt_version": PROMPT_VERSION,
                "analysis_version": version,
                "building_id": evidence_pack["building_id"] if evidence_pack else None,
                "period": evidence_pack["period"] if evidence_pack else None,
                "batch_id": batch["id"] if batch else None,
                "content": output,
                "current": True,
                "cached": False,
                "usage": metadata,
                "data_type": c["data_type"],
            }
            put(s, c["tenant"], "AIResponse", key, response)
            put(s, c["tenant"], "AIUsage", str(uuid4()), metadata)
            s.commit()
            return response
        except HTTPException as exc:
            put(
                s,
                c["tenant"],
                "AIUsage",
                str(uuid4()),
                invocation.metadata(feature, False, "HTTP" + str(exc.status_code)),
            )
            s.commit()
            raise
        except Exception as exc:
            metadata = invocation.metadata(feature, False, type(exc).__name__)
            put(s, c["tenant"], "AIUsage", str(uuid4()), metadata)
            s.commit()
            return {
                "feature": feature,
                "mode": "safe_fallback",
                "content": None,
                "current": False,
                "message": "Claude output is unavailable or failed evidence validation. Use the verified engine evidence or manual workflow.",
                "usage": metadata,
            }

    @router.post("/mapping")
    def mapping(body: MappingInput, c=Depends(writer), s=Depends(db)):
        batch = get(s, c["tenant"], "ImportBatch", body.batch_id)
        if not batch or "headers" not in batch:
            raise HTTPException(404, "Import preview not found")
        return generate("mapping", body, s, c, batch=batch)

    @router.post("/buildings/{bid}/explanation")
    def explain(bid: str, body: AIInput, c=Depends(writer), s=Depends(db)):
        return generate("explanation", body, s, c, pack(s, c, bid, body.start, body.end))

    @router.post("/buildings/{bid}/task-draft")
    def draft(bid: str, body: AIInput, c=Depends(writer), s=Depends(db)):
        return generate("task_draft", body, s, c, pack(s, c, bid, body.start, body.end))

    @router.get("/responses/{id}")
    def response(id: str, c=Depends(context), s=Depends(db)):
        item = get(s, c["tenant"], "AIResponse", id)
        if not item:
            raise HTTPException(404, "AI response not found")
        if item["feature"] == "assistant":
            versions = {
                bid: pack(s, c, bid, item["period"]["start"], item["period"]["end"])["analysis_version"]
                for bid in item["evidence"]["building_ids"]
            }
            version = digest(versions)
        elif item["building_id"]:
            period = item["period"]
            version = pack(s, c, item["building_id"], period["start"], period["end"])["analysis_version"]
        else:
            batch = get(s, c["tenant"], "ImportBatch", item["batch_id"])
            version = digest({k: batch[k] for k in ("id", "headers", "preview")}) if batch else "deleted"
        fresh = (
            datetime.now(timezone.utc) - datetime.fromisoformat(item["created_at"])
        ).total_seconds() < 3600
        return dict(item, current=version == item["analysis_version"] and fresh)

    @router.post("/drafts/{id}/approve")
    def approve(id: str, body: Approval, c=Depends(writer), s=Depends(db)):
        item = get(s, c["tenant"], "AIResponse", id)
        if not item or item["feature"] != "task_draft":
            raise HTTPException(404, "Draft not found")
        if not body.confirmed:
            raise HTTPException(428, "Explicit task approval is required")
        checked = response(id, c, s)
        if not checked["current"] or body.analysis_version != item["analysis_version"]:
            raise HTTPException(409, "Analysis or sources changed. Generate and review a new draft.")
        task_id = "ai-" + id
        existing = get(s, c["tenant"], "Task", task_id)
        if existing:
            return existing
        task = dict(
            body.model_dump(mode="json", exclude={"confirmed"}),
            id=task_id,
            building_id=item["building_id"],
            status="new",
            ai_draft_id=id,
            source_ids=item["content"]["source_ids"],
            checklist=item["content"]["checks"],
            closure_records=item["content"]["closure_records"],
            missing_information=item["content"]["missing_information"],
            history=[{"at": now(), "status": "new", "note": body.note}],
        )
        s.add(Entity(tenant=c["tenant"], kind="Task", id=task_id, data=task))
        try:
            s.flush()
            audit(
                s,
                c,
                "task.ai_approved",
                {"task_id": task_id, "draft_id": id, "analysis_version": body.analysis_version},
            )
            s.commit()
        except IntegrityError:
            s.rollback()
            task = get(s, c["tenant"], "Task", task_id)
            if not task:
                raise HTTPException(409, "Task approval conflicted; retry the same draft") from None
        return task

    @router.post("/buildings/{bid}/maintenance-summary")
    def maintenance(bid: str, body: Question, c=Depends(writer), s=Depends(db)):
        cfg = authorize(s, c, body.approved_data_transfer, "maintenance_summary")
        current = pack(s, c, bid, body.start, body.end)
        flags = current["sources"][0]["data"]["flagged_months"]
        before = flags[0] if flags else body.start
        matches = [x for x in document_search(s, c, bid) if x["date"] <= before]
        if not matches:
            return {
                "mode": "safe_fallback",
                "content": None,
                "message": "No readable maintenance documents dated before this finding are available. Add dated source notes or a text PDF.",
                "current": True,
            }
        invocation = invoke(s, c, cfg, "maintenance_summary")
        try:
            excerpts = [{**x, "text": x["text"][:3000]} for x in matches[:4]]
            blocks = [
                {
                    "type": "document",
                    "title": x["title"] + " / page " + str(x["page"]),
                    "source": {"type": "text", "media_type": "text/plain", "data": x["text"]},
                    "citations": {"enabled": True},
                }
                for x in excerpts
            ]
            blocks.append(
                {
                    "type": "text",
                    "text": json.dumps(
                        {
                            "question": body.question,
                            "recorded_before": before,
                            "rules": "Summarize recorded maintenance only, cite every text block. Dates and quantities must be present in cited excerpts. State that timing does not establish causality. No fault diagnosis or savings claim.",
                        }
                    ),
                }
            )
            # Native citations deliberately use a separate non-JSON request.
            result = invocation.call(
                {
                    "system": SYSTEM.replace(
                        "prose MUST contain NO digits", "structured prose MUST contain NO digits"
                    ),
                    "messages": [{"role": "user", "content": blocks}],
                }
            )
            content = []
            for block in result["content"]:
                if block["type"] != "text" or not block["text"].strip():
                    continue
                citations = []
                for citation in block.get("citations", []):
                    index = citation.get("document_index", -1)
                    if citation.get("type") != "char_location" or not 0 <= index < len(excerpts):
                        raise ValueError("Invalid document citation")
                    doc = excerpts[index]
                    a, b = citation["start_char_index"], citation["end_char_index"]
                    if not 0 <= a < b <= len(doc["text"]):
                        raise ValueError("Invalid citation span")
                    cited = " ".join(citation["cited_text"].split())
                    if not cited or cited not in " ".join(doc["text"][a:b].split()):
                        raise ValueError("Citation text does not match source")
                    source_entry = next(x for x in current["sources"] if x["id"] == doc["source_id"])
                    citations.append(
                        {
                            "source_id": doc["source_id"],
                            "url": source_entry["url"],
                            "title": doc["title"],
                            "version": doc["version"],
                            "page": doc["page"],
                            "date": doc["date"],
                            "start_char": a,
                            "end_char": b,
                            "quote": citation["cited_text"],
                        }
                    )
                if not citations:
                    raise ValueError("Uncited summary block rejected")
                allowed_numbers = set(re.findall(r"\d+(?:[.,]\d+)*", " ".join(x["quote"] for x in citations)))
                if not set(re.findall(r"\d+(?:[.,]\d+)*", block["text"])) <= allowed_numbers:
                    raise ValueError("Unsupported number in cited summary")
                if re.search(
                    r"\b(guarantee\w*|definitely|certainly|proven|caused by|will save|confidence score)\b",
                    block["text"],
                    re.I,
                ):
                    raise ValueError("Causal certainty rejected")
                content.append({"text": block["text"], "citations": citations})
            if not content:
                raise ValueError("No cited summary")
            metadata = invocation.metadata("maintenance_summary", True)
            item = {
                "id": str(uuid4()),
                "feature": "maintenance_summary",
                "mode": "live_claude",
                "created_at": now(),
                "model": cfg["model"],
                "prompt_version": PROMPT_VERSION,
                "analysis_version": current["analysis_version"],
                "building_id": bid,
                "period": current["period"],
                "content": content,
                "current": True,
                "usage": metadata,
                "limitation": "Recorded timing does not establish causality. Human review required.",
                "data_type": c["data_type"],
            }
            put(s, c["tenant"], "AIResponse", item["id"], item)
        except HTTPException as exc:
            put(
                s,
                c["tenant"],
                "AIUsage",
                str(uuid4()),
                invocation.metadata("maintenance_summary", False, "HTTP" + str(exc.status_code)),
            )
            s.commit()
            raise
        except Exception as exc:
            metadata = invocation.metadata("maintenance_summary", False, type(exc).__name__)
            item = {
                "mode": "safe_fallback",
                "content": None,
                "message": "A source-verified summary could not be produced. Review the original dated documents instead.",
                "current": False,
            }
        put(s, c["tenant"], "AIUsage", str(uuid4()), metadata)
        s.commit()
        return item

    @router.post("/assistant")
    def assistant(body: Question, c=Depends(writer), s=Depends(db)):
        cfg = authorize(s, c, body.approved_data_transfer, "assistant")
        dates(body.start, body.end)
        tool_names = (
            "list_buildings",
            "get_building_summary",
            "list_findings",
            "get_finding_evidence",
            "list_interventions",
            "search_building_documents",
        )
        tools = [
            {
                "name": name,
                "description": "Read tenant-scoped "
                + name.replace("_", " ")
                + ". Unused fields must be null. Lists are limited to eight buildings; narrow filters for more.",
                "strict": True,
                "input_schema": anthropic.transform_schema(ToolArgs),
            }
            for name in tool_names
        ]
        gathered = {"metrics": {}, "sources": [], "building_ids": []}
        versions = {}
        messages = [{"role": "user", "content": body.question}]
        invocation = invoke(s, c, cfg, "assistant")
        count = 0

        def collect(bid):
            current = pack(s, c, bid, body.start, body.end)
            versions[bid] = current["analysis_version"]
            if bid not in gathered["building_ids"]:
                gathered["building_ids"].append(bid)
                gathered["metrics"].update({bid + "." + k: v for k, v in current["metrics"].items()})
                gathered["sources"].extend([{**x, "id": bid + "::" + x["id"]} for x in current["sources"]])
            return current

        try:
            for _ in range(4):
                result = invocation.call(
                    {
                        "system": SYSTEM,
                        "messages": messages,
                        "tools": tools,
                        "output_config": {
                            "format": {"type": "json_schema", "schema": anthropic.transform_schema(Answer)}
                        },
                    }
                )
                calls = [x for x in result["content"] if x["type"] == "tool_use"]
                if not calls:
                    text = "".join(x["text"] for x in result["content"] if x["type"] == "text")
                    answer = validate_output("assistant", json.loads(text), gathered)
                    if not answer["unsupported"] and not count:
                        raise ValueError("Answer requires an application tool result")
                    break
                messages.append({"role": "assistant", "content": result["content"]})
                outputs = []
                for call in calls:
                    count += 1
                    if count > 6 or call["name"] not in tool_names:
                        raise ValueError("Tool limit or allowlist violation")
                    args = ToolArgs.model_validate(call["input"])
                    name, bid = call["name"], args.building_id
                    if name in ("list_buildings", "list_findings"):
                        rows = results(s, c, body.start, body.end)
                        rows = [
                            x
                            for x in rows
                            if (not args.status or x["status"] == args.status)
                            and (not args.quality or x["quality"] == args.quality)
                            and (name != "list_findings" or x["status"] == "investigate")
                        ]
                        data = {"total_matches": len(rows), "truncated": len(rows) > 8, "buildings": []}
                        for row in rows[:8]:
                            current = collect(row["id"])
                            data["buildings"].append(
                                {
                                    "id": row["id"],
                                    "status": row["status"],
                                    "quality": row["quality"],
                                    "source_id": row["id"] + "::analysis",
                                    "metrics": {
                                        row["id"] + ".deviation": current["metrics"]["deviation"],
                                        row["id"] + ".missing_months": current["metrics"]["missing_months"],
                                    },
                                }
                            )
                    elif not bid:
                        raise ValueError("A building ID is required for this tool")
                    else:
                        current = collect(bid)
                        if name == "search_building_documents":
                            data = [
                                {**x, "text": x["text"][:600], "source_id": bid + "::" + x["source_id"]}
                                for x in document_search(s, c, bid, args.query or "")
                            ]
                        elif name == "list_interventions":
                            data = [
                                {"source_id": bid + "::" + x["id"], "record": x["data"]}
                                for x in current["sources"]
                                if x["kind"] == "intervention"
                            ][:8]
                        else:
                            data = {
                                "building_id": bid,
                                "status": current["status"],
                                "quality": current["quality"],
                                "metrics": {bid + "." + k: v for k, v in current["metrics"].items()},
                                "source_ids": [bid + "::analysis"],
                            }
                    serialized = json.dumps(data, ensure_ascii=False)
                    if len(serialized) > 6000:
                        raise ValueError("Tool result size limit reached")
                    outputs.append({"type": "tool_result", "tool_use_id": call["id"], "content": serialized})
                messages.append({"role": "user", "content": outputs})
            else:
                raise ValueError("Tool step limit reached")
            metadata = invocation.metadata("assistant", True)
            referenced = set(answer["source_ids"])
            evidence_out = {
                "building_ids": gathered["building_ids"],
                "metrics": gathered["metrics"],
                "sources": [x for x in gathered["sources"] if x["id"] in referenced],
            }
            item = {
                "id": str(uuid4()),
                "feature": "assistant",
                "mode": "live_claude",
                "created_at": now(),
                "model": cfg["model"],
                "prompt_version": PROMPT_VERSION,
                "analysis_version": digest(versions),
                "building_id": None,
                "period": {"start": body.start, "end": body.end},
                "content": answer,
                "evidence": evidence_out,
                "current": True,
                "usage": metadata,
                "data_type": c["data_type"],
            }
            put(s, c["tenant"], "AIResponse", item["id"], item)
        except HTTPException as exc:
            put(
                s,
                c["tenant"],
                "AIUsage",
                str(uuid4()),
                invocation.metadata("assistant", False, "HTTP" + str(exc.status_code)),
            )
            s.commit()
            raise
        except Exception as exc:
            metadata = invocation.metadata("assistant", False, type(exc).__name__)
            item = {
                "mode": "safe_fallback",
                "content": None,
                "message": "This question could not be answered with the permitted evidence/tools. Use portfolio filters and building evidence.",
                "current": False,
            }
        put(s, c["tenant"], "AIUsage", str(uuid4()), metadata)
        s.commit()
        return item

    @router.get("/usage")
    def usage(c=Depends(context), s=Depends(db)):
        return sorted(all_items(s, c["tenant"], "AIUsage"), key=lambda x: x["at"], reverse=True)[:50]

    return router
