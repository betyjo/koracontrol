"""
Ensure the PostgreSQL schema named in DATABASES default OPTIONS (search_path)
exists before running migrate. Django is configured with e.g. -c search_path=kora.
"""
import os
import re
import sys

import django

# kora_backend/create_kora_schema.py → parent is project root on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "kora_control.settings")
django.setup()

import psycopg2
from django.conf import settings


def schema_from_options(db: dict) -> str:
    raw = db.get("OPTIONS", {}).get("options", "") or ""
    m = re.search(r"search_path\s*=\s*([^\s,;]+)", raw, re.I)
    if m:
        return m.group(1).strip().strip('"')
    return "public"


def main() -> None:
    db = settings.DATABASES["default"]
    schema = schema_from_options(db)
    if schema == "public":
        print("No custom search_path in DATABASES; nothing to create.")
        return

    conn = psycopg2.connect(
        dbname=db["NAME"],
        user=db["USER"],
        password=db["PASSWORD"],
        host=db.get("HOST") or "localhost",
        port=str(db.get("PORT") or "5432"),
    )
    conn.autocommit = True
    user = db["USER"]
    try:
        with conn.cursor() as cur:
            cur.execute(
                f'CREATE SCHEMA IF NOT EXISTS "{schema}" AUTHORIZATION "{user}";'
            )
        print(f'Schema "{schema}" ensured for user "{user}".')
    finally:
        conn.close()


if __name__ == "__main__":
    main()
