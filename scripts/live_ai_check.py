"""Opt-in paid synthetic-only smoke check; never logs keys or raw provider payloads."""
import json
import os
from pathlib import Path
import httpx


def main():
    if os.getenv("AI_LIVE_TEST_CONSENT") != "synthetic-only":
        raise SystemExit("Skipped: set AI_LIVE_TEST_CONSENT=synthetic-only to authorize one synthetic live request.")
    with httpx.Client(base_url="http://127.0.0.1:8000", timeout=50) as client:
        client.post("/api/session").raise_for_status()
        status = client.get("/api/ai/status").json()
        if status["data_type"] != "synthetic" or not status["server_enabled"] or not status["provider_configured"]:
            raise SystemExit("Skipped: backend must be configured and session must contain synthetic data.")
        client.put("/api/ai/settings", json={"enabled": True}).raise_for_status()
        response = client.post("/api/ai/buildings/SYN-003/explanation", json={"approved_data_transfer": True})
        response.raise_for_status()
        result = response.json()
        evidence = {k: result.get(k) for k in ("mode", "model", "created_at", "analysis_version", "usage")}
        evidence["scope"] = "One live synthetic finding explanation; not field validation or full live feature coverage."
        Path("reports/live-ai-result.json").write_text(json.dumps(evidence, indent=2), encoding="utf-8")
        print(json.dumps(evidence, indent=2))
        if result.get("mode") != "live_claude":
            raise SystemExit("Live response did not pass backend validation; core analysis remains available.")


if __name__ == "__main__":
    main()
