#!/usr/bin/env python3
"""
tools/attack_demo.py - Clarix AI Out-of-Band Tamper Attack Tool (Demo Only)

Simulates real-world attacker operations directly against the SQLite database file,
completely bypassing application-level APIs, just as an adversary with local filesystem
or database access would.

SECURITY RESTRICTION:
This script STRICTLY REFUSES to run against production databases. It only targets the
isolated demo ledger (data/demo/clarix.db).
"""
import argparse
import hashlib
import json
import os
import sqlite3
import sys
from pathlib import Path

# ANSI colors for presentation / projector readability
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
CYAN = "\033[96m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"

# Enable VT100 colors on Windows terminals
if sys.platform == "win32":
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
    except Exception:
        pass

FIELDS = ("id", "timestamp", "user", "action", "component", "risk", "decision", "classification", "payload")
GENESIS = "0" * 64


def canonical_of(rec: dict) -> str:
    return json.dumps({k: rec[k] for k in FIELDS}, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def resolve_demo_db(custom_path: str | None = None) -> Path:
    """Resolve database path and strictly enforce DEMO isolation."""
    if custom_path:
        db_path = Path(custom_path).resolve()
    else:
        # Default: locate project root relative to this script
        proj_root = Path(__file__).resolve().parents[1]
        c1 = (proj_root / "data" / "demo" / "clarix_demo.db").resolve()
        c2 = (proj_root / "backend" / "data" / "demo" / "clarix_demo.db").resolve()
        db_path = c1 if c1.is_file() else (c2 if c2.is_file() else c1)

    # CRITICAL SECURITY CHECK 1: Path must contain 'demo' AND filename must be 'clarix_demo.db'
    parts = [p.lower() for p in db_path.parts]
    if "demo" not in parts or db_path.name.lower() != "clarix_demo.db":
        print(f"\n{RED}{BOLD}[REFUSED TO EXECUTE]{RESET}")
        print(f"{RED}Target database: {db_path}{RESET}")
        print(f"{RED}ERROR: attack_demo.py is strictly restricted to DEMO databases only.{RESET}")
        print(f"{RED}Requirement: Path must contain a 'demo' directory and filename must be 'clarix_demo.db'.{RESET}")
        print(f"{RED}Aborting immediately to protect production data and the immutable real ledger.{RESET}\n")
        sys.exit(1)

    if not db_path.is_file():
        print(f"{RED}Error: Demo database file does not exist at {db_path}.{RESET}")
        print(f"{YELLOW}Hint: Start Clarix in demo mode (CLARIX_DEMO_MODE=1) or click 'Reset Demo Ledger' in UI.{RESET}")
        sys.exit(1)

    # CRITICAL SECURITY CHECK 2: Marker verification in SQLite schema
    try:
        con = sqlite3.connect(str(db_path))
        cur = con.cursor()
        has_marker = cur.execute(
            "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='demo_metadata'"
        ).fetchone()[0]
        if not has_marker:
            print(f"\n{RED}{BOLD}[REFUSED TO EXECUTE: MISSING DEMO MARKER TABLE]{RESET}")
            print(f"{RED}Target database: {db_path}{RESET}")
            print(f"{RED}ERROR: The target database does not contain the 'demo_metadata' sandbox marker table.{RESET}")
            print(f"{RED}This prevents attacks against copies of the real production ledger!{RESET}\n")
            con.close()
            sys.exit(1)

        val = cur.execute(
            "SELECT value FROM demo_metadata WHERE key='ledger_type'"
        ).fetchone()
        con.close()
        if not val or val[0] != "clarix_demo_sandbox":
            print(f"\n{RED}{BOLD}[REFUSED TO EXECUTE: INVALID DEMO MARKER]{RESET}")
            print(f"{RED}Target database: {db_path}{RESET}")
            print(f"{RED}ERROR: 'demo_metadata.ledger_type' is not 'clarix_demo_sandbox'.{RESET}\n")
            sys.exit(1)
    except Exception as e:
        print(f"\n{RED}{BOLD}[REFUSED TO EXECUTE: SQLITE VALIDATION ERROR]{RESET}")
        print(f"{RED}Could not inspect database marker: {e}{RESET}\n")
        sys.exit(1)

    return db_path


def list_events(db_path: Path, limit: int = 15):
    print(f"\n{CYAN}{BOLD}=== CLARIX AI DEMO AUDIT LEDGER (First {limit} Events) ==={RESET}")
    print(f"Database: {DIM}{db_path}{RESET}\n")
    con = sqlite3.connect(str(db_path))
    con.row_factory = sqlite3.Row
    try:
        rows = con.execute("SELECT seq, id, timestamp, user, action, decision, risk, hash FROM audit_events ORDER BY seq ASC LIMIT ?", (limit,)).fetchall()
        if not rows:
            print(f"{YELLOW}No audit events found. Run demo reset first!{RESET}")
            return

        fmt = "{:<4} {:<12} {:<20} {:<10} {:<18} {:<8} {:<16}"
        print(fmt.format("SEQ", "ID", "TIMESTAMP", "DECISION", "RISK", "USER", "ACTION"))
        print("-" * 92)
        for r in rows:
            dec_color = RED if r["decision"] == "BLOCK" else (YELLOW if r["decision"] == "REQUIRE_APPROVAL" else GREEN)
            print(fmt.format(
                r["seq"],
                r["id"],
                r["timestamp"][:19],
                f"{dec_color}{r['decision']}{RESET}",
                r["risk"],
                r["user"][:8],
                r["action"][:32]
            ))
        total = con.execute("SELECT count(*) n FROM audit_events").fetchone()["n"]
        print(f"\nTotal committed events in database: {BOLD}{total}{RESET}\n")
    finally:
        con.close()


def edit_row(db_path: Path, target_n: int, rehash: bool = False):
    print(f"\n{RED}{BOLD}[ATTACK INITIATED] Out-of-band row tampering on Event seq={target_n}{RESET}")
    con = sqlite3.connect(str(db_path))
    try:
        cur = con.cursor()

        # Step 1: Drop SQLite trigger
        print(f"{YELLOW}[Step 1/3] Attacker drops SQLite trigger 'audit_no_update'...{RESET}")
        cur.execute("DROP TRIGGER IF EXISTS audit_no_update")
        con.commit()
        print(f"         {GREEN}✓ Trigger dropped! SQLite append-only enforcement bypassed.{RESET}")

        # Find target row
        row = cur.execute("SELECT * FROM audit_events WHERE seq=? OR id=?", (target_n, f"EVT-{target_n:06d}")).fetchone()
        if not row:
            print(f"{RED}Error: Event {target_n} not found in database.{RESET}")
            return

        cols = [d[0] for d in cur.description]
        row_dict = dict(zip(cols, row))
        old_decision = row_dict["decision"]
        new_decision = "ALLOW" if old_decision == "BLOCK" else "BLOCK"
        old_action = row_dict["action"]
        new_action = old_action.replace("Blocked", "Allowed").replace("BLOCKED", "ALLOWED")

        print(f"{YELLOW}[Step 2/3] Modifying Event {row_dict['id']} directly in database file:{RESET}")
        print(f"         Decision: {RED}{old_decision}{RESET} → {GREEN}{new_decision}{RESET}")
        print(f"         Payload:  tampered_payload_unauthorized_bypass")

        cur.execute(
            "UPDATE audit_events SET decision=?, action=?, payload=? WHERE seq=?",
            (new_decision, new_action, "tampered_payload_unauthorized_bypass", row_dict["seq"])
        )
        con.commit()
        print(f"         {GREEN}✓ Database updated directly on disk.{RESET}")

        if not rehash:
            print(f"{YELLOW}[Step 3/3] Crude attack completed (no hash recalculation).{RESET}")
            print(f"{RED}{BOLD}Result: Stored hash no longer matches record contents.{RESET}")
            print(f"Next step: Observe Clarix fail-closed lockdown screen within 5 seconds!\n")
            return

        # SMART ATTACK: Rehash entire chain with plain SHA-256
        print(f"\n{CYAN}{BOLD}[SMART ATTACK] Recomputing plain SHA-256 hash chain for all subsequent rows...{RESET}")
        all_rows = cur.execute("SELECT * FROM audit_events ORDER BY seq ASC").fetchall()
        prev = GENESIS
        recomputed_count = 0
        for r in all_rows:
            r_dict = dict(zip(cols, r))
            rec = {k: r_dict[k] for k in FIELDS}
            canon = canonical_of(rec)
            # Attacker recomputes plain SHA-256 (does NOT have the secret HMAC key!)
            h = hashlib.sha256((prev + canon).encode("utf-8")).hexdigest()
            cur.execute("UPDATE audit_events SET canonical=?, prev_hash=?, hash=? WHERE seq=?",
                        (canon, prev, h, r_dict["seq"]))
            prev = h
            recomputed_count += 1

        con.commit()
        print(f"{GREEN}✓ Attacker recomputed {recomputed_count} hashes using plain SHA-256.{RESET}")
        print(f"{GREEN}✓ Downstream parent-hash links are now continuous!{RESET}")
        print(f"{YELLOW}{BOLD}Attacker perspective: Chain looks 100% valid to a basic SHA-256 verifier.{RESET}")
        print(f"{RED}{BOLD}Clarix perspective: Secret HMAC key was not used -> FAIL-CLOSED LOCKDOWN!{RESET}\n")

    finally:
        con.close()


def truncate_tail(db_path: Path, count: int = 10):
    print(f"\n{RED}{BOLD}[ATTACK INITIATED] Truncating last {count} audit records to hide activity...{RESET}")
    con = sqlite3.connect(str(db_path))
    try:
        cur = con.cursor()
        print(f"{YELLOW}[Step 1/2] Dropping SQLite trigger 'audit_no_delete'...{RESET}")
        cur.execute("DROP TRIGGER IF EXISTS audit_no_delete")
        con.commit()
        print(f"         {GREEN}✓ Trigger dropped!{RESET}")

        print(f"{YELLOW}[Step 2/2] Deleting latest {count} rows from audit_events...{RESET}")
        cur.execute("DELETE FROM audit_events WHERE seq IN (SELECT seq FROM audit_events ORDER BY seq DESC LIMIT ?)", (count,))
        deleted = cur.rowcount
        con.commit()
        print(f"         {GREEN}✓ Deleted {deleted} records from SQLite.{RESET}")

        remaining = cur.execute("SELECT count(*) FROM audit_events").fetchone()[0]
        print(f"{YELLOW}{BOLD}Remaining events in DB: {remaining}{RESET}")
        print(f"{RED}{BOLD}Result: Database has {remaining} entries, but external signed anchor records more!{RESET}")
        print(f"Next step: Observe Clarix catch anchor mismatch within 5 seconds!\n")
    finally:
        con.close()


def rollback_db(db_path: Path):
    print(f"\n{RED}{BOLD}[ATTACK INITIATED] Rolling back database to earlier sequence state...{RESET}")
    con = sqlite3.connect(str(db_path))
    try:
        cur = con.cursor()
        cur.execute("DROP TRIGGER IF EXISTS audit_no_delete")
        cur.execute("DELETE FROM audit_events WHERE seq > 15")
        con.commit()
        print(f"{GREEN}✓ Database rolled back: all events past seq 15 removed.{RESET}")
        print(f"{RED}{BOLD}Result: Anchor head hash and count mismatch!{RESET}\n")
    finally:
        con.close()


def forge_row(db_path: Path):
    print(f"\n{RED}{BOLD}[ATTACK INITIATED] Forging counterfeit audit record into SQLite...{RESET}")
    con = sqlite3.connect(str(db_path))
    try:
        cur = con.cursor()
        last = cur.execute("SELECT seq, hash FROM audit_events ORDER BY seq DESC LIMIT 1").fetchone()
        seq = (last[0] if last else 0) + 1
        prev = last[1] if last else GENESIS

        rec = {
            "id": f"EVT-{seq:06d}",
            "timestamp": "2026-11-21T18:00:00Z",
            "user": "adversary",
            "action": "Covert admin credential grant",
            "component": "Security Engine",
            "risk": "LOW",
            "decision": "ALLOW",
            "classification": "PUBLIC",
            "payload": "grant:role=superadmin:forged=true"
        }
        canon = canonical_of(rec)
        h = hashlib.sha256((prev + canon).encode("utf-8")).hexdigest()

        cur.execute(
            "INSERT INTO audit_events VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (seq, rec["id"], rec["timestamp"], rec["user"], rec["action"], rec["component"],
             rec["risk"], rec["decision"], rec["classification"], rec["payload"], canon, prev, h)
        )
        con.commit()
        print(f"{GREEN}✓ Forged event {rec['id']} inserted with valid plain SHA-256 hash.{RESET}")
        print(f"{RED}{BOLD}Result: Record lacks valid HMAC signature and exceeds external anchor count!{RESET}\n")
    finally:
        con.close()


def change_permission(db_path: Path, tool: str, level: str):
    print(f"\n{RED}{BOLD}[ATTACK INITIATED] Escalating tool permissions in SQLite: {tool} → {level}{RESET}")
    con = sqlite3.connect(str(db_path))
    try:
        cur = con.cursor()
        cur.execute("UPDATE tools SET level=? WHERE id=?", (level.upper(), tool.lower()))
        con.commit()
        print(f"{GREEN}✓ Tool '{tool}' permission updated to '{level.upper()}' in 'tools' table.{RESET}")
        print(f"{RED}{BOLD}Result: Signed security state HMAC signature invalid!{RESET}\n")
    finally:
        con.close()


def disable_policy(db_path: Path, policy_id: str):
    print(f"\n{RED}{BOLD}[ATTACK INITIATED] Disabling security policy directly in SQLite: {policy_id}{RESET}")
    con = sqlite3.connect(str(db_path))
    try:
        cur = con.cursor()
        cur.execute("UPDATE policies SET enabled=0 WHERE id=?", (policy_id.upper(),))
        con.commit()
        print(f"{GREEN}✓ Policy '{policy_id.upper()}' set to enabled=0 in 'policies' table.{RESET}")
        print(f"{RED}{BOLD}Result: Signed security state HMAC signature invalid!{RESET}\n")
    finally:
        con.close()


def drop_trigger_attack(db_path: Path):
    print(f"\n{RED}{BOLD}[ATTACK INITIATED] Dropping SQLite trigger 'audit_no_update' and modifying row...{RESET}")
    con = sqlite3.connect(str(db_path))
    try:
        cur = con.cursor()
        print(f"{YELLOW}[Step 1/2] Dropping SQLite trigger 'audit_no_update'...{RESET}")
        cur.execute("DROP TRIGGER IF EXISTS audit_no_update")
        con.commit()
        print(f"         {GREEN}✓ Trigger 'audit_no_update' dropped!{RESET}")

        print(f"{YELLOW}[Step 2/2] Updating event payload directly on disk...{RESET}")
        cur.execute("UPDATE audit_events SET payload='tampered_out_of_band_without_trigger' WHERE seq=5")
        con.commit()
        print(f"         {GREEN}✓ Event seq=5 payload altered directly on disk.{RESET}")
        print(f"{RED}{BOLD}Result: Missing trigger detected by Trigger Guard -> FAIL-CLOSED LOCKDOWN!{RESET}\n")
    finally:
        con.close()


def legacy_verify(db_path: Path):
    print(f"\n{BLUE}{BOLD}=== LEGACY PLAIN SHA-256 VERIFIER (Simulating Basic Audit Checker) ==={RESET}")
    print(f"Database: {DIM}{db_path}{RESET}\n")
    con = sqlite3.connect(str(db_path))
    con.row_factory = sqlite3.Row
    try:
        rows = con.execute("SELECT * FROM audit_events ORDER BY seq ASC").fetchall()
        if not rows:
            print(f"{YELLOW}Empty audit ledger.{RESET}")
            return

        prev = GENESIS
        expected_seq = 1
        broken_id = None
        broken_reason = None

        for r in rows:
            rec = {k: r[k] for k in FIELDS}
            canon = canonical_of(rec)
            if r["seq"] != expected_seq:
                broken_id = r["id"]
                broken_reason = f"Sequence gap: expected {expected_seq}, found {r['seq']}"
                break
            if r["prev_hash"] != prev:
                broken_id = r["id"]
                broken_reason = f"Parent hash mismatch"
                break
            h = hashlib.sha256((r["prev_hash"] + canon).encode("utf-8")).hexdigest()
            if h != r["hash"]:
                broken_id = r["id"]
                broken_reason = f"Plain SHA-256 hash mismatch"
                break
            prev = r["hash"]
            expected_seq = r["seq"] + 1

        if broken_id:
            print(f"{RED}{BOLD}[LEGACY VERIFIER STATUS] BROKEN ❌{RESET}")
            print(f"Failure at event: {BOLD}{broken_id}{RESET}")
            print(f"Reason: {RED}{broken_reason}{RESET}\n")
        else:
            print(f"{GREEN}{BOLD}[LEGACY VERIFIER STATUS] VALID / CLEAN ✅{RESET}")
            print(f"Continuous hash chain verified across {BOLD}{len(rows)}{RESET} records.")
            print(f"Head digest: {CYAN}{prev[:20]}...{prev[-12:]}{RESET}")
            print(f"\n{YELLOW}{BOLD}CRITICAL OBSERVATION FOR COMPETITION JUDGES:{RESET}")
            print(f"{YELLOW}The legacy plain-SHA-256 verifier says this database is 100% VALID!{RESET}")
            print(f"{YELLOW}It CANNOT detect smart rehash, truncation, rollback, or permission changes.{RESET}")
            print(f"{CYAN}Clarix AI keyed HMAC-SHA256 and external anchor catch all of these instantly.{RESET}\n")

    finally:
        con.close()


def main():
    parser = argparse.ArgumentParser(
        description="Clarix AI Out-of-Band Tamper Attack Tool (Demo Only)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python tools/attack_demo.py --list
  python tools/attack_demo.py --edit-row 6
  python tools/attack_demo.py --edit-row 6 --rehash
  python tools/attack_demo.py --legacy-verify
  python tools/attack_demo.py --truncate 10
  python tools/attack_demo.py --permission shell NORMAL
  python tools/attack_demo.py --disable-policy POL-001
  python tools/attack_demo.py --drop-trigger
        """
    )
    parser.add_argument("--db", help="Path to demo SQLite database (must contain 'demo')")
    parser.add_argument("--list", action="store_true", help="List audit events in the demo ledger")
    parser.add_argument("--edit-row", type=int, metavar="N", help="Tamper with event sequence N directly in SQLite")
    parser.add_argument("--rehash", action="store_true", help="Combine with --edit-row: rehash downstream chain with plain SHA-256")
    parser.add_argument("--truncate", type=int, metavar="K", help="Delete last K events from demo ledger")
    parser.add_argument("--rollback", action="store_true", help="Roll back audit ledger to earlier sequence state")
    parser.add_argument("--forge", action="store_true", help="Insert a counterfeit audit record with plain SHA-256 hash")
    parser.add_argument("--permission", nargs=2, metavar=("TOOL", "LEVEL"), help="Modify tool permission directly in DB (e.g. shell ALLOW)")
    parser.add_argument("--disable-policy", metavar="POL_ID", help="Disable security policy directly in DB (e.g. POL-001)")
    parser.add_argument("--drop-trigger", action="store_true", help="Drop SQLite audit_no_update trigger and modify row")
    parser.add_argument("--legacy-verify", action="store_true", help="Run legacy plain-SHA256 verifier without HMAC key")

    args = parser.parse_args()

    # Resolve and validate DB
    db_path = resolve_demo_db(args.db)

    if args.list:
        list_events(db_path)
    elif args.edit_row is not None:
        edit_row(db_path, args.edit_row, rehash=args.rehash)
    elif args.truncate is not None:
        truncate_tail(db_path, args.truncate)
    elif args.rollback:
        rollback_db(db_path)
    elif args.forge:
        forge_row(db_path)
    elif args.permission:
        change_permission(db_path, args.permission[0], args.permission[1])
    elif args.disable_policy:
        disable_policy(db_path, args.disable_policy)
    elif args.drop_trigger:
        drop_trigger_attack(db_path)
    elif args.legacy_verify:
        legacy_verify(db_path)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
