"""Export a pristine synthetic portfolio for the offline backup package."""

from pathlib import Path
import httpx

root = Path(__file__).resolve().parents[1]
with httpx.Client(base_url="http://127.0.0.1:8000", timeout=30) as client:
    client.post("/api/session").raise_for_status()
    for extension in ("pdf", "csv"):
        response = client.get("/api/reports/" + extension)
        response.raise_for_status()
        (root / f"reports/demo-evidence.{extension}").write_bytes(response.content)
print("Pristine synthetic evidence exported for offline use.")
