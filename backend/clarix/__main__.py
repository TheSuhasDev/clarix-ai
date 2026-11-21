"""python -m clarix [--server fastapi|stdlib] [--check]"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import logging
import os
import shutil
import stat
import sys
import time
from datetime import datetime
from pathlib import Path

from .airgap import guard, monitor
from .app import create_app, create_context
from .config import ConfigError, Settings


FRESH_INSTALL_CONFIRMATION = "I CONFIRM FRESH INSTALL"


def perform_fresh_install(settings: Settings, confirmation: str | None, reseed_samples: bool = False) -> int:
    real_dir = Path(getattr(settings, "real_data_dir", settings.data_dir))
    lockdown_p = real_dir / "lockdown.json"
    if lockdown_p.is_file():
        print(f"\n[REFUSED] Cannot perform fresh install while system is in FAIL-CLOSED LOCKDOWN ({lockdown_p}).", file=sys.stderr)
        print("Recover the system first or resolve the integrity incident before proceeding.", file=sys.stderr)
        return 1

    if (confirmation or "").strip() != FRESH_INSTALL_CONFIRMATION:
        print(f"\n[CONFIRMATION REQUIRED] To perform a clean fresh install, you must provide:\n"
              f"  --confirm \"{FRESH_INSTALL_CONFIRMATION}\"\n", file=sys.stderr)
        return 1

    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    archive_dir = real_dir / "archive" / ts
    archive_dir.mkdir(parents=True, exist_ok=True)

    files_to_archive = ["clarix.db", "audit.key", "audit_anchor.json", "security_state.json", "incidents.log"]
    archived = []
    for fname in files_to_archive:
        src = real_dir / fname
        if src.is_file():
            dst = archive_dir / fname
            shutil.copy2(src, dst)
            try:
                src.unlink()
            except Exception:
                pass
            archived.append(fname)

    print(f"\n[CLARIX AI] Fresh install initiated.")
    print(f"Archived {len(archived)} existing files to: {archive_dir}")

    # 1. Create fresh DB with schema
    from .db import Database, SCHEMA
    from .audit import AuditLog, utcstamp
    from .security.policy import POLICIES
    from .tools.registry import TOOLS

    db_path = real_dir / "clarix.db"
    db = Database(db_path)
    con = db.conn()
    con.executescript(SCHEMA)
    for p in POLICIES:
        con.execute("INSERT OR REPLACE INTO policies(id, enabled, enforcements, last_modified) VALUES(?,1,0,?)", (p.id, utcstamp()))
    for t in TOOLS.values():
        con.execute("INSERT OR REPLACE INTO tools(id, level, executions, last_run) VALUES(?,?,0,NULL)", (t.id, t.default_level))
    con.commit()

    # 2. Fresh 32-byte HMAC key
    key_path = real_dir / "audit.key"
    key = os.urandom(32)
    key_path.write_bytes(key.hex().encode("ascii"))
    try:
        os.chmod(key_path, stat.S_IRUSR | stat.S_IWUSR)
    except Exception:
        pass

    # 3. Write 1 genesis SYSTEM_INSTALL event
    audit = AuditLog(db, key=key)
    audit._upgrade_seq = 1
    audit.append(
        user="system",
        action="SYSTEM_INSTALL",
        component="System",
        risk="LOW",
        decision="ALLOW",
        classification="INTERNAL",
        payload="initial_clean_install:genesis:algorithm=HMAC-SHA256"
    )

    # 4. Optional re-seeding of sample documents for production live ledger
    if reseed_samples:
        import struct
        workspace_dir = real_dir / "workspace"
        samples = [
            ("network_topology.csv", "INTERNAL"),
            ("database_access_policy.txt", "INTERNAL"),
        ]
        for fname, cls in samples:
            fpath = workspace_dir / fname
            if fpath.is_file():
                try:
                    content = fpath.read_text(encoding="utf-8", errors="replace")
                    size_kb = max(1, len(content.encode("utf-8")) // 1024)
                    sh = hashlib.sha256(content.encode("utf-8")).hexdigest()
                    now_iso = utcstamp()
                    con = db.conn()
                    con.execute(
                        "INSERT OR REPLACE INTO rag_documents(name,size_kb,chunks,status,trust,classification,last_indexed,embedding_model,sha256,flagged_chunks) "
                        "VALUES(?,?,?,?,?,?,?,?,?,0)",
                        (fname, size_kb, 1, "INDEXED", "OPERATOR", cls, now_iso, "nomic-embed-text", sh)
                    )
                    dummy_emb = struct.pack(f"{128}f", *([0.0] * 128))
                    con.execute(
                        "INSERT INTO rag_chunks(doc_name,page,text,embedding,dim,flagged) VALUES(?,?,?,?,?,0)",
                        (fname, 1, content[:2000], dummy_emb, 128)
                    )
                    con.commit()
                    audit.append(
                        user="operator",
                        action=f"Document ingested: {fname}",
                        component="Vector RAG",
                        risk="LOW",
                        decision="ALLOW",
                        classification=cls,
                        payload=f"rag:ingest:{fname}:{sh[:16]}"
                    )
                except Exception as e:
                    print(f"Warning: could not re-seed {fname}: {e}")

    h = audit.head()

    # 4. Write signed external anchor
    anchor_path = real_dir / "audit_anchor.json"
    now_ts = utcstamp()
    canon_anchor = f"{h['count']}:{h['hash']}:{now_ts}"
    sig = hmac.new(key, canon_anchor.encode("utf-8"), hashlib.sha256).hexdigest()
    anchor_path.write_text(json.dumps({
        "count": h["count"],
        "head_hash": h["hash"],
        "timestamp": now_ts,
        "signature": sig,
        "algorithm": "HMAC-SHA256",
        "key_source": "audit.key"
    }, indent=2), encoding="utf-8")

    # 5. Sign security state
    policies = sorted([{"id": r["id"], "enabled": bool(r["enabled"])} for r in db.q("SELECT id, enabled FROM policies")], key=lambda x: x["id"])
    tools = sorted([{"id": r["id"], "level": r["level"]} for r in db.q("SELECT id, level FROM tools")], key=lambda x: x["id"])
    docs = sorted([{"name": r["name"], "classification": r["classification"]} for r in db.q("SELECT name, classification FROM rag_documents")], key=lambda x: x["name"])
    state_obj = {"policies": policies, "tools": tools, "docs": docs}
    canonical_str = json.dumps(state_obj, sort_keys=True, separators=(",", ":"))
    state_sig = hmac.new(key, canonical_str.encode("utf-8"), hashlib.sha256).hexdigest()
    (real_dir / "security_state.json").write_text(json.dumps({
        "timestamp": utcstamp(),
        "state": state_obj,
        "signature": state_sig
    }, indent=2), encoding="utf-8")

    # 6. Verify fresh chain
    v = audit.verify()
    print(f"Committed 1 genesis event: seq={h['count']} hash={h['hash'][:16]}...")
    print(f"Chain verification: {'VALID (OK)' if v.get('ok') else 'FAILED'}")
    print(f"Fresh install completed successfully.\n")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="clarix")
    ap.add_argument("--server", choices=["fastapi", "stdlib"], default="fastapi")
    ap.add_argument("--check", action="store_true", help="print configuration, host air-gap posture and Ollama reachability, then exit")
    ap.add_argument("--fresh-install", action="store_true", help="archive existing database and create clean fresh install")
    ap.add_argument("--confirm", type=str, help="confirmation phrase for fresh install")
    a = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    try:
        settings = Settings.from_env()
    except ConfigError as e:
        print(f"Configuration error: {e}", file=sys.stderr)
        return 2

    if a.fresh_install:
        return perform_fresh_install(settings, a.confirm, reseed_samples=True)
    if a.check:
        ctx = create_context(settings)
        try:
            ollama = {"reachable": True, "version": ctx.ollama.version()}
        except Exception as e:
            ollama = {"reachable": False, "error": str(e)}
        print(json.dumps({"host": settings.host, "port": settings.port, "dataDir": str(settings.data_dir), "authEnabled": settings.auth_enabled,
                          "guard": guard.status(), "posture": monitor.posture(guard.status()), "ollama": ollama,
                          "auditChain": ctx.audit.verify()}, indent=2, default=str))
        return 0
    if settings.ephemeral_token:
        print(f"\n{'='*72}\n[CLARIX AI] OPERATOR AUTHENTICATION REQUIRED (SEC-01)\n"
              f"Ephemeral Operator Token generated for this session:\n"
              f"  >>> {settings.ephemeral_token} <<<\n"
              f"Set CLARIX_API_TOKEN in .env or pass in Authorization: Bearer <token>\n"
              f"To run without auth for local demos: set CLARIX_DEMO_MODE=1\n{'='*72}\n", flush=True)
    if a.server == "fastapi":
        try:
            import uvicorn
            app = create_app(settings)
        except ImportError as e:
            print(f"FastAPI/uvicorn not installed ({e}). Run `pip install -r requirements.txt`, or use --server stdlib for the dependency-free server.", file=sys.stderr)
            return 3
        uvicorn.run(app, host=settings.host, port=settings.port, log_level="info", server_header=False)
        return 0
    from .web.stdlib_server import make_server
    ctx = create_context(settings)
    ctx.start()
    srv = make_server(ctx)
    logging.getLogger("clarix").info("stdlib server on http://%s:%s (development fallback)", *srv.server_address[:2])
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        ctx.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
