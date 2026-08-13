#!/usr/bin/env python3
"""Create (or migrate) data/ta/ta.sqlite from scripts/ta/schema.sql. Idempotent."""
import sqlite3, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
DB = ROOT / 'data' / 'ta' / 'ta.sqlite'
SCHEMA = pathlib.Path(__file__).with_name('schema.sql')

DB.parent.mkdir(parents=True, exist_ok=True)
con = sqlite3.connect(DB)
con.executescript(SCHEMA.read_text())
con.commit()
tables = [r[0] for r in con.execute(
    "select name from sqlite_master where type='table' order by name")]
print(f"{DB} ready — tables: {', '.join(tables)}")
con.close()
