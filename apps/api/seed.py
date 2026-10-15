import os
from .db import seed

if __name__ == "__main__":
    if os.getenv("APP_MODE", "demo") != "demo":
        raise SystemExit("Refusing synthetic seed outside demo mode")
    seed()
