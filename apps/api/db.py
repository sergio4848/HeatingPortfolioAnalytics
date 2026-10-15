import os
from sqlalchemy import create_engine, String, JSON, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, Session


class Base(DeclarativeBase):
    pass


class Entity(Base):
    __tablename__ = "entities"
    tenant: Mapped[str] = mapped_column(String(80), primary_key=True)
    kind: Mapped[str] = mapped_column(String(40), primary_key=True)
    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON)


engine = create_engine(os.getenv("DATABASE_URL", "sqlite:///./portotherm.db"), pool_pre_ping=True)


def put(s, tenant, kind, id, data):
    s.merge(Entity(tenant=tenant, kind=kind, id=str(id), data=data))


def get(s, tenant, kind, id):
    e = s.get(Entity, (tenant, kind, str(id)))
    return e.data if e else None


def all_items(s, tenant, kind):
    return [
        e.data
        for e in s.scalars(
            select(Entity).where(Entity.tenant == tenant, Entity.kind == kind).order_by(Entity.id)
        )
    ]


def seed():
    from .synthetic import generate

    with Session(engine) as s:
        if get(s, "demo", "Organization", "demo"):
            return
        d = generate()
        put(
            s,
            "demo",
            "Organization",
            "demo",
            {
                "id": "demo",
                "name": "Demo portfolio",
                "threshold": 0.2,
                "unit": "kWh",
                "data_type": "synthetic",
            },
        )
        for b in d["buildings"]:
            put(s, "demo", "Building", b["id"], b)
        for i, r in enumerate(d["records"]):
            put(s, "demo", "ConsumptionRecord", i, r)
        for period, w in d["weather"].items():
            put(s, "demo", "WeatherRecord", period, dict(w, period_start=period))
        for i in d["interventions"]:
            put(s, "demo", "Intervention", i["id"], i)
        put(
            s,
            "demo",
            "ImportBatch",
            "seed",
            dict(id="seed", issues=d["issues"], source="synthetic seed", status="committed"),
        )
        put(
            s, "demo", "User", "demo-analyst", {"id": "demo-analyst", "label": "Demo analyst role, fictional"}
        )
        put(s, "demo", "Membership", "demo-analyst", {"subject": "demo-analyst", "role": "admin"})
        s.commit()
