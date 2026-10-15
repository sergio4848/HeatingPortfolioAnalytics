import os
import subprocess
import sys
from sqlalchemy import create_engine, text


def test_clean_migration_and_idempotent_seed(tmp_path):
    url = "sqlite:///" + str(tmp_path / "fresh.db")
    env = dict(os.environ, DATABASE_URL=url, APP_MODE="demo")
    for args in [
        ("alembic", "upgrade", "head"),
        ("alembic", "upgrade", "head"),
        ("apps.api.seed",),
        ("apps.api.seed",),
    ]:
        result = subprocess.run(
            [sys.executable, "-m", *args], env=env, capture_output=True, text=True, timeout=30
        )
        assert result.returncode == 0, result.stderr
    with create_engine(url).connect() as c:
        assert (
            c.execute(text("select count(*) from entities where tenant='demo' and kind='Building'")).scalar()
            == 12
        )
