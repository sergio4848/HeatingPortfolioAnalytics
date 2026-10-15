"""Exercise real JWT verification without a network IdP dependency."""

from types import SimpleNamespace
from datetime import datetime, timezone, timedelta
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy.orm import Session
from tests.test_api import client  # noqa: F401, F811 -- shared isolated fixture
from apps.api import main, db


def test_verified_membership_roles_and_foreign_reports(client, monkeypatch):  # noqa: F811
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.setenv("OIDC_ISSUER", "https://identity.example")
    monkeypatch.setenv("OIDC_AUDIENCE", "portfolio")
    monkeypatch.setenv("OIDC_JWKS_URL", "https://identity.example/jwks")
    monkeypatch.setattr(main, "MODE", "pilot")
    monkeypatch.setattr(
        jwt,
        "PyJWKClient",
        lambda _: SimpleNamespace(
            get_signing_key_from_jwt=lambda token: SimpleNamespace(key=key.public_key())
        ),
    )
    with Session(main.engine) as s:
        db.put(
            s, "pilot-A", "Organization", "pilot-A", {"name": "Pilot A test", "threshold": 0.2, "unit": "kWh"}
        )
        db.put(s, "pilot-A", "Membership", "viewer-A", {"role": "viewer"})
        db.put(s, "pilot-A", "Membership", "admin-A", {"role": "admin"})
        db.put(
            s, "pilot-B", "Organization", "pilot-B", {"name": "Pilot B test", "threshold": 0.2, "unit": "kWh"}
        )
        db.put(s, "pilot-B", "Building", "SECRET-B", {"id": "SECRET-B"})
        s.commit()

    def token(subject, **extra):
        claims = {
            "sub": subject,
            "iss": "https://identity.example",
            "aud": "portfolio",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
        }
        return jwt.encode(dict(claims, **extra), key, algorithm="RS256")

    client.headers["authorization"] = "Bearer " + token("viewer-A")
    assert client.get("/api/portfolio").json()["total"] == 0
    assert client.get("/api/reports/pdf").status_code == 200
    assert client.get("/api/reports/pdf?bid=SECRET-B").status_code == 404
    assert client.get("/api/buildings/SECRET-B?organization=pilot-B").status_code == 404
    assert client.post("/api/tasks", json={"building_id": "SECRET-B"}).status_code == 403
    assert client.put("/api/settings", json={"name": "bad", "threshold": 0.3}).status_code == 403
    client.headers["authorization"] = "Bearer " + token("admin-A")
    assert client.put("/api/settings", json={"name": "Changed", "threshold": 0.3}).status_code == 200
    assert client.post("/api/reset").status_code == 403
    client.headers["authorization"] = "Bearer " + token("not-a-member")
    assert client.get("/api/reports/pdf").status_code == 403
    client.headers["authorization"] = "Bearer " + token("viewer-A", aud="wrong")
    assert client.get("/api/portfolio").status_code == 401
    client.headers["authorization"] = "Bearer " + token("viewer-A", exp=1)
    assert client.get("/api/portfolio").status_code == 401
