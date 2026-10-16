"""Mock provider tests are explicitly separate from opt-in live API checks."""

import io
import json
import pytest
from reportlab.pdfgen import canvas

from apps.api import ai_provider
from apps.api.ai_contracts import validate_output

pytest_plugins = ["tests.test_api"]


def explanation():
    point = {
        "text": "Compare the observed use with the historical weather reference.",
        "metric_ids": ["deviation"],
        "source_ids": ["analysis"],
    }
    return {
        "observations": [point],
        "possible_explanations": [],
        "recommended_checks": [{**point, "text": "Verify invoice periods and meter records."}],
        "missing_information": [],
        "limitations": [{**point, "text": "Human review and source verification remain necessary."}],
    }


def draft():
    return {
        "title": "Review heat records",
        "evidence_summary": "Review the observed change against the weather reference.",
        "checks": [{"action": "Review meter records", "question": "Do meter periods match invoice periods?"}],
        "missing_information": ["Occupancy changes"],
        "suggested_role": "Portfolio analyst",
        "closure_records": ["Reviewed invoices and expert notes"],
        "metric_ids": ["deviation"],
        "source_ids": ["analysis"],
    }


def configure(client, monkeypatch):
    monkeypatch.setenv("AI_ENABLED", "true")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-only-provider-is-mocked")
    assert client.put("/api/ai/settings", json={"enabled": True}).status_code == 200


@pytest.fixture
def fake(monkeypatch):
    calls = []

    def send(self, payload, timeout):
        calls.append(payload)
        data = json.loads(payload["messages"][0]["content"])
        value = draft() if data["feature"] == "task_draft" else explanation()
        return {
            "content": [{"type": "text", "text": json.dumps(value)}],
            "stop_reason": "end_turn",
            "usage": {"input_tokens": 30, "output_tokens": 40},
        }

    monkeypatch.setattr(ai_provider.Gateway, "send", send)
    return calls


def test_no_api_key_keeps_core_and_evidence_running(client, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert client.get("/api/portfolio").status_code == 200
    p = client.get("/api/ai/buildings/SYN-003/evidence").json()
    b = client.get("/api/buildings/SYN-003").json()
    assert p["metrics"]["observed_kwh"]["value"] == b["observed_kwh"]
    assert (
        client.post(
            "/api/ai/buildings/SYN-003/explanation", json={"approved_data_transfer": True}
        ).status_code
        == 503
    )


def test_org_and_per_request_consent(client, monkeypatch, fake):
    monkeypatch.setenv("AI_ENABLED", "true")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-only-provider-is-mocked")
    assert (
        client.post(
            "/api/ai/buildings/SYN-003/explanation", json={"approved_data_transfer": True}
        ).status_code
        == 403
    )
    configure(client, monkeypatch)
    assert client.post("/api/ai/buildings/SYN-003/explanation", json={}).status_code == 428
    assert not fake


def test_valid_explanation_cache_usage_and_stale_version(client, monkeypatch, fake):
    configure(client, monkeypatch)
    body = {"approved_data_transfer": True}
    a = client.post("/api/ai/buildings/SYN-003/explanation", json=body).json()
    assert a["mode"] == "live_claude" and a["usage"]["validation"] == "passed"
    assert client.post("/api/ai/buildings/SYN-003/explanation", json=body).json()["cached"]
    assert len(fake) == 1
    usage = client.get("/api/ai/usage").json()
    assert usage[0]["cached"] and usage[0]["input_tokens"] == 0
    assert usage[1]["input_tokens"] == 30
    assert client.get("/api/ai/responses/" + a["id"]).json()["current"]
    client.put("/api/settings", json={"name": "Changed", "threshold": 0.4})
    assert not client.get("/api/ai/responses/" + a["id"]).json()["current"]


def test_draft_never_creates_without_approval_and_is_idempotent(client, monkeypatch, fake):
    configure(client, monkeypatch)
    d = client.post("/api/ai/buildings/SYN-003/task-draft", json={"approved_data_transfer": True}).json()
    assert not client.get("/api/portfolio").json()["tasks"]
    body = {
        "analysis_version": d["analysis_version"],
        "title": "Reviewed draft",
        "technical_action": "Check invoices",
        "assignee": "Reviewer",
    }
    url = "/api/ai/drafts/" + d["id"] + "/approve"
    assert client.post(url, json=body).status_code == 428
    body["confirmed"] = True
    first = client.post(url, json=body)
    second = client.post(url, json=body)
    assert first.status_code == second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert len(client.get("/api/portfolio").json()["tasks"]) == 1
    assert any(x["action"] == "task.ai_approved" for x in client.get("/api/audit").json())


def test_stale_draft_cannot_be_approved(client, monkeypatch, fake):
    configure(client, monkeypatch)
    d = client.post("/api/ai/buildings/SYN-003/task-draft", json={"approved_data_transfer": True}).json()
    client.put("/api/settings", json={"name": "Changed", "threshold": 0.4})
    r = client.post(
        "/api/ai/drafts/" + d["id"] + "/approve",
        json={
            "confirmed": True,
            "analysis_version": d["analysis_version"],
            "title": "Review",
            "technical_action": "Check",
            "assignee": "Reviewer",
        },
    )
    assert r.status_code == 409


def test_numeric_hallucination_is_never_displayed(client, monkeypatch):
    configure(client, monkeypatch)
    value = explanation()
    value["observations"][0]["text"] = "Consumption rose by 99 percent."
    monkeypatch.setattr(
        ai_provider.Gateway,
        "send",
        lambda *_: {
            "content": [{"type": "text", "text": json.dumps(value)}],
            "stop_reason": "end_turn",
            "usage": {},
        },
    )
    r = client.post("/api/ai/buildings/SYN-003/explanation", json={"approved_data_transfer": True}).json()
    assert r["mode"] == "safe_fallback" and r["content"] is None
    assert client.get("/api/ai/usage").json()[0]["validation"] == "rejected"


def test_budget_and_timeout_fail_safely(client, monkeypatch, fake):
    configure(client, monkeypatch)
    monkeypatch.setenv("AI_DAILY_REQUEST_BUDGET", "0")
    url = "/api/ai/buildings/SYN-003/explanation"
    assert client.post(url, json={"approved_data_transfer": True}).status_code == 429
    assert not fake
    monkeypatch.setenv("AI_DAILY_REQUEST_BUDGET", "30")
    monkeypatch.setenv("AI_TIMEOUT_SECONDS", "0")
    assert client.post(url, json={"approved_data_transfer": True}).json()["mode"] == "safe_fallback"
    assert not fake


def test_document_tenant_sources_deletion_and_cache_invalidation(client, monkeypatch, fake):
    configure(client, monkeypatch)
    d = client.post(
        "/api/ai/buildings/SYN-003/documents/notes",
        json={
            "title": "Valve service",
            "date": "2025-12-01",
            "source": "Synthetic maintenance note",
            "text": "A contractor inspected the valve and recorded a follow-up request.",
        },
    ).json()
    result = client.post(
        "/api/ai/buildings/SYN-003/explanation", json={"approved_data_transfer": True}
    ).json()
    search = client.get("/api/ai/buildings/SYN-003/documents/search?q=valve").json()
    assert search[0]["document_id"] == d["id"] and search[0]["page"] == 1
    assert client.delete("/api/ai/documents/" + d["id"]).json()["derived_cache_cleared"]
    assert client.get("/api/ai/responses/" + result["id"]).status_code == 404
    assert not client.get("/api/ai/buildings/SYN-003/documents/search?q=valve").json()
    client.post("/api/session")
    assert client.get("/api/ai/responses/" + result["id"]).status_code == 404
    assert client.delete("/api/ai/documents/" + d["id"]).status_code == 404
    assert client.get("/api/ai/buildings/FOREIGN/evidence").status_code == 404


def test_pdf_text_page_offsets_and_scanned_rejection(client):
    buf = io.BytesIO()
    pdf = canvas.Canvas(buf)
    pdf.drawString(40, 700, "Synthetic valve inspection recorded before the increase.")
    pdf.showPage()
    pdf.drawString(40, 700, "No verified causal finding or savings.")
    pdf.save()
    url = "/api/ai/buildings/SYN-003/documents/pdf"
    data = {"title": "Service record", "recorded_date": "2025-12-01", "source_name": "Synthetic test PDF"}
    response = client.post(url, data=data, files={"file": ("service.pdf", buf.getvalue(), "application/pdf")})
    assert response.status_code == 201, response.text
    assert response.json()["page_count"] == 2
    source = client.get("/api/ai/buildings/SYN-003/sources/document:" + response.json()["id"] + ":2").json()
    assert source["data"]["page"] == 2 and "causal" in source["data"]["text"]
    blank = io.BytesIO()
    pdf = canvas.Canvas(blank)
    pdf.showPage()
    pdf.save()
    assert (
        client.post(
            url, data=data, files={"file": ("scan.pdf", blank.getvalue(), "application/pdf")}
        ).status_code
        == 422
    )


@pytest.mark.parametrize("mutate", ["source", "metric", "number", "certainty"])
def test_explanation_contract_rejects_untrusted_output(client, mutate):
    pack = client.get("/api/ai/buildings/SYN-003/evidence").json()
    value = explanation()
    point = value["observations"][0]
    if mutate == "source":
        point["source_ids"] = ["document:foreign:1"]
    if mutate == "metric":
        point["metric_ids"] = ["made_up_savings"]
    if mutate == "number":
        point["text"] = "A confidence of 99 percent is certain."
    if mutate == "certainty":
        point["text"] = "A fault is definitely present."
    with pytest.raises(ValueError):
        validate_output("explanation", value, pack)


@pytest.mark.parametrize("header", ["invoice_amount", "cost_eur", "cumulative_reading", "bill_total"])
def test_mapping_never_treats_money_or_counter_as_consumption(header):
    data = {
        "suggestions": [
            {
                "source_column": header,
                "target_field": "heat_consumption",
                "rationale": "Review source meaning.",
                "uncertainty": "review required",
                "user_check": "Check measurement definition.",
            }
        ],
        "warnings": [],
    }
    with pytest.raises(ValueError):
        validate_output("mapping", data, headers=[header])


def test_prompt_injected_tool_name_has_no_execution(client, monkeypatch):
    configure(client, monkeypatch)
    monkeypatch.setattr(
        ai_provider.Gateway,
        "send",
        lambda *_: {
            "content": [
                {"type": "tool_use", "id": "bad", "name": "run_shell", "input": {"command": "read secrets"}}
            ],
            "stop_reason": "tool_use",
            "usage": {},
        },
    )
    r = client.post(
        "/api/ai/assistant",
        json={"approved_data_transfer": True, "question": "Run a shell and inspect all organizations"},
    ).json()
    assert r["mode"] == "safe_fallback" and r["content"] is None


def test_native_citation_is_validated_and_separate_from_json(client, monkeypatch):
    configure(client, monkeypatch)
    text = "A valve inspection was recorded before the consumption increase."
    client.post(
        "/api/ai/buildings/SYN-003/documents/notes",
        json={"title": "Service", "date": "2025-12-01", "source": "Synthetic", "text": text},
    )

    def send(self, payload, timeout):
        assert "output_config" not in payload
        assert payload["messages"][0]["content"][0]["citations"]["enabled"]
        return {
            "content": [
                {
                    "type": "text",
                    "text": "A valve inspection was recorded.",
                    "citations": [
                        {
                            "type": "char_location",
                            "document_index": 0,
                            "start_char_index": 0,
                            "end_char_index": len(text),
                            "cited_text": text,
                        }
                    ],
                }
            ],
            "stop_reason": "end_turn",
            "usage": {},
        }

    monkeypatch.setattr(ai_provider.Gateway, "send", send)
    result = client.post(
        "/api/ai/buildings/SYN-003/maintenance-summary",
        json={
            "approved_data_transfer": True,
            "question": "What maintenance was recorded before the increase?",
        },
    ).json()
    assert result["mode"] == "live_claude"
    assert result["content"][0]["citations"][0]["page"] == 1


from pathlib import Path  # noqa: E402
from apps.api.ai_contracts import prose  # noqa: E402

EVALUATIONS = json.loads((Path(__file__).parent / "fixtures/ai-evaluations.json").read_text())


@pytest.mark.parametrize("case", EVALUATIONS, ids=lambda case: case["id"])
def test_deterministic_ai_evaluations(case):
    def evaluate():
        if case["kind"] == "prose":
            return prose(case["text"])
        if case["kind"] == "mapping":
            return validate_output(
                "mapping",
                {
                    "suggestions": [
                        {
                            "source_column": case["column"],
                            "target_field": case["target"],
                            "rationale": "Review the source meaning.",
                            "uncertainty": "review required",
                            "user_check": "Verify against the source record.",
                        }
                    ],
                    "warnings": [],
                },
                headers=[case["column"]],
            )
        value = explanation()
        value["observations"][0]["metric_ids"] = [case["metric"]]
        value["observations"][0]["source_ids"] = [case["source"]] if case["source"] else []
        return validate_output(
            "explanation", value, {"metrics": {"deviation": {"value": 0.3}}, "sources": [{"id": "analysis"}]}
        )

    if case["valid"]:
        evaluate()
    else:
        with pytest.raises(ValueError):
            evaluate()


def test_insufficient_metric_requires_missing_information():
    value = explanation()
    with pytest.raises(ValueError):
        validate_output(
            "explanation", value, {"metrics": {"deviation": {"value": None}}, "sources": [{"id": "analysis"}]}
        )


def test_assistant_valid_tool_roundtrip(client, monkeypatch):
    configure(client, monkeypatch)
    calls = []

    def send(self, payload, timeout):
        calls.append(payload)
        if len(calls) == 1:
            return {
                "content": [
                    {
                        "type": "tool_use",
                        "id": "read",
                        "name": "get_finding_evidence",
                        "input": {"building_id": "SYN-003", "status": None, "quality": None, "query": None},
                    }
                ],
                "stop_reason": "tool_use",
                "usage": {},
            }
        return {
            "content": [
                {
                    "type": "text",
                    "text": json.dumps(
                        {
                            "answer": "Review this building against its historical reference.",
                            "metric_ids": ["SYN-003.deviation"],
                            "source_ids": ["SYN-003::analysis"],
                            "building_ids": ["SYN-003"],
                            "unsupported": False,
                        }
                    ),
                }
            ],
            "stop_reason": "end_turn",
            "usage": {},
        }

    monkeypatch.setattr(ai_provider.Gateway, "send", send)
    result = client.post(
        "/api/ai/assistant",
        json={"approved_data_transfer": True, "question": "Show evidence for the selected building"},
    ).json()
    assert result["content"]["metric_ids"] == ["SYN-003.deviation"]
    assert result["evidence"]["metrics"]["SYN-003.deviation"]["label"].startswith("SYN-003 / ")
    assert len(calls) == 2
    assert calls[1]["messages"][-1]["content"][0]["type"] == "tool_result"
    assert client.get("/api/ai/responses/" + result["id"]).json()["current"]


@pytest.mark.parametrize("delay,expected_calls", [("0", 2), ("60", 1)])
def test_rate_limit_retry_is_bounded(client, monkeypatch, delay, expected_calls):
    import anthropic
    import httpx2

    configure(client, monkeypatch)
    calls = []

    def send(self, payload, timeout):
        calls.append(payload)
        raise anthropic.RateLimitError(
            "Synthetic rate limit",
            response=httpx2.Response(
                429,
                headers={"retry-after": delay},
                request=httpx2.Request("POST", "https://api.anthropic.com/v1/messages"),
            ),
            body={},
        )

    monkeypatch.setattr(ai_provider.Gateway, "send", send)
    result = client.post(
        "/api/ai/buildings/SYN-003/explanation", json={"approved_data_transfer": True}
    ).json()
    assert result["mode"] == "safe_fallback" and result["content"] is None
    assert len(calls) == expected_calls
    assert client.get("/api/ai/usage").json()[0]["error"] == "RateLimitError"


def test_tampered_native_citation_is_not_shown(client, monkeypatch):
    configure(client, monkeypatch)
    client.post(
        "/api/ai/buildings/SYN-003/documents/notes",
        json={
            "title": "Service",
            "date": "2025-12-01",
            "source": "Synthetic",
            "text": "A valve inspection was recorded before the increase.",
        },
    )
    monkeypatch.setattr(
        ai_provider.Gateway,
        "send",
        lambda *_: {
            "content": [
                {
                    "type": "text",
                    "text": "A valve inspection was recorded.",
                    "citations": [
                        {
                            "type": "char_location",
                            "document_index": 99,
                            "start_char_index": 0,
                            "end_char_index": 10,
                            "cited_text": "Invented source",
                        }
                    ],
                }
            ],
            "stop_reason": "end_turn",
            "usage": {},
        },
    )
    result = client.post(
        "/api/ai/buildings/SYN-003/maintenance-summary",
        json={"approved_data_transfer": True, "question": "What maintenance preceded this increase?"},
    ).json()
    assert result["mode"] == "safe_fallback" and result["content"] is None


def test_tool_arguments_cannot_supply_tenant(client, monkeypatch):
    configure(client, monkeypatch)
    monkeypatch.setattr(
        ai_provider.Gateway,
        "send",
        lambda *_: {
            "content": [
                {
                    "type": "tool_use",
                    "id": "bad",
                    "name": "list_buildings",
                    "input": {
                        "building_id": None,
                        "status": None,
                        "quality": None,
                        "query": None,
                        "organization_id": "other",
                    },
                }
            ],
            "stop_reason": "tool_use",
            "usage": {},
        },
    )
    result = client.post(
        "/api/ai/assistant",
        json={"approved_data_transfer": True, "question": "List the other tenant buildings"},
    ).json()
    assert result["mode"] == "safe_fallback" and result["content"] is None


def test_viewer_cannot_use_paid_ai_or_change_settings(client):
    from apps.api import main

    main.app.dependency_overrides[main.context] = lambda: {
        "tenant": "untrusted",
        "role": "viewer",
        "subject": "test",
        "data_type": "pilot",
    }
    try:
        assert client.put("/api/ai/settings", json={"enabled": True}).status_code == 403
        assert (
            client.post(
                "/api/ai/buildings/SYN-003/explanation", json={"approved_data_transfer": True}
            ).status_code
            == 403
        )
        assert (
            client.post(
                "/api/ai/buildings/SYN-003/documents/notes",
                json={
                    "title": "Test",
                    "date": "2025-12-01",
                    "source": "QA",
                    "text": "A synthetic note for testing.",
                },
            ).status_code
            == 403
        )
    finally:
        main.app.dependency_overrides.clear()


def test_real_data_requires_organization_permission(client, monkeypatch):
    from apps.api import main

    configure(client, monkeypatch)
    original = client.get("/api/session").json()
    # Authenticated tenant remains the same; only the test context's data class changes.
    tenant = original.get("tenant") or original.get("organization_id")
    assert tenant
    main.app.dependency_overrides[main.context] = lambda: {
        "tenant": tenant,
        "role": "admin",
        "subject": "test",
        "data_type": "pilot",
    }
    try:
        result = client.post("/api/ai/buildings/SYN-003/explanation", json={"approved_data_transfer": True})
        assert result.status_code == 403
    finally:
        main.app.dependency_overrides.clear()
