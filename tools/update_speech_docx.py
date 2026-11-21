"""Update Clarix_Judge_Speech.docx with Tamper Lockdown Demo improvements."""

import copy
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

DOCX_PATH = "Clarix_Judge_Speech.docx"

def style_cell(cell, bg_color=None, border_color=None):
    tcPr = cell._tc.get_or_add_tcPr()
    if bg_color:
        shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{bg_color}"/>')
        tcPr.append(shd)
    if border_color:
        borders = parse_xml(
            f'<w:tcBorders {nsdecls("w")}>'
            f'<w:top w:val="single" w:sz="8" w:space="0" w:color="{border_color}"/>'
            f'<w:left w:val="single" w:sz="16" w:space="0" w:color="{border_color}"/>'
            f'<w:bottom w:val="single" w:sz="8" w:space="0" w:color="{border_color}"/>'
            f'<w:right w:val="single" w:sz="8" w:space="0" w:color="{border_color}"/>'
            f'</w:tcBorders>'
        )
        tcPr.append(borders)

def update_document():
    doc = docx.Document(DOCX_PATH)

    # 1. Update Paragraphs
    for p in doc.paragraphs:
        txt = p.text
        # P73: replace mathematically impossible
        if "mathematically impossible for an LLM to take an action without clearing our pipeline" in txt:
            p.text = txt.replace(
                "mathematically impossible for an LLM to take an action without clearing our pipeline",
                "cryptographically verifiable and policy-enforced that an LLM cannot execute an action without clearing our pipeline"
            )
            print("Updated P73: mathematically impossible -> cryptographically verifiable")

        # P148: Page 16 speech
        if "In many software products, 'audit logging' is just writing lines of text" in txt:
            p.text = (
                "[2-min] [5-min] [full] [Click 'Audit Logs' in the sidebar and gesture broadly to the ledger.] "
                "Judges, this is the cryptographic bedrock of Clarix AI: our Tamper-Evident Audit Ledger. "
                "In many software products, 'audit logging' is just writing lines of text to a log file. "
                "Any rogue system administrator or hacker with root access can open that file, delete evidence of their attack, and save it. "
                "In Clarix, that is tamper-evident and cryptographically detectable. Every single event—every prompt, policy decision, "
                "tool invocation, and evidence verification—is hashed into a sequential HMAC-SHA256 chain inside SQLite. "
                "Each block incorporates the previous block's hash, sealed with an air-gapped secret key stored outside the database in audit.key. "
                "Furthermore, our SQLite database enforces append-only triggers: audit_no_update and audit_no_delete reject any UPDATE or DELETE "
                "query with an immediate database exception! [Point to the Export Anchor button and the DEMO LEDGER badge.] "
                "And on every single commit, an external signed anchor file, audit_anchor.json, is updated with the current block count and head hash. "
                "Even if someone truncates rows or rolls the database back to yesterday, the external anchor instantly exposes the fraud."
            )
            print("Updated P148: Page 16 audit speech")

        # P157: Page 17 speech
        if "What happens if an attacker bypasses the application entirely—opening the SQLite file with a hex editor" in txt:
            p.text = (
                "[2-min] [5-min] [full] [Click 'SHA-256 Integrity' in the sidebar.] What happens if an adversary bypasses the application entirely—"
                "opening SQLite directly from the command line, editing an audit decision, or elevating permissions? "
                "That is where POL-006, our Cryptographic Tamper Lockdown Guard, takes over. Clarix protects system integrity with four defense layers: "
                "keyed HMAC-SHA256, an external head anchor, signed security state (covering all policies and tool permissions), and SQLite triggers. "
                "Every 2.5 seconds, our continuous background monitor checks all four layers. If any out-of-band tampering occurs, Clarix triggers "
                "an immediate Fail-Closed Lockdown! All agent chat, tool execution, and document ingestion are blocked with HTTP 423 Locked, and a "
                "full-screen red lockdown overlay takes over. [Point to the Attacker View vs Clarix View comparison.] Look at the live comparison card: "
                "a legacy unkeyed SHA-256 verifier reports the rehashed database as 100% clean and valid, completely blind to the attack! "
                "But Clarix instantly flags the invalid HMAC and anchor mismatch. To recover, an administrator must provide credentials, a mandatory "
                "20+ character security justification, and type the exact confirmation phrase 'I CONFIRM REBASELINE OF SECURITY STATE' to re-anchor the state."
            )
            print("Updated P157: Page 17 integrity speech")

        # P181: Section 3 Attack 5
        if "Attack Number Five: A malicious administrator edits the SQLite database file directly on disk." in txt:
            p.text = (
                "[2-min] [5-min] [full] [Pause, gesture firmly toward the screen.] Attack Number Three: An attacker uploads a poisoned PDF with invisible white text "
                "that orders the agent to format the drive. Our RAG Gate quarantines the infected chunk before retrieval. Attack Number Four: The agent tries to "
                "execute a shell tool. It is trapped in our Human Approval Queue until a security officer approves it. And Attack Number Five: A smart attacker "
                "edits row 14 in SQLite directly and recomputes the entire plain SHA-256 chain downstream. Standard verifiers say '100% CLEAN'. But in less than "
                "2.5 seconds, Clarix AI detects the secret HMAC key mismatch and anchor divergence, triggers POL-006 Fail-Closed Lockdown, returns HTTP 423, and "
                "freezes all reasoning until authenticated recovery with a 20+ character justification. Five attacks. Five independent layers. Zero compromises."
            )
            print("Updated P181: Section 3 Attack 5")

        # P198: 2-Minute Elevator Pitch
        if "And if someone attempts to tamper with the database file directly on disk, our tamper guard detects the HMAC mismatch" in txt:
            p.text = txt.replace(
                "And if someone attempts to tamper with the database file directly on disk, our tamper guard detects the HMAC mismatch, locking the entire system fail-closed with HTTP 423.",
                "And if an attacker edits the database directly and recalculates all downstream hashes, our legacy verifier is fooled, but Clarix detects the missing HMAC key and anchor mismatch in under 2.5 seconds, locking down fail-closed with HTTP 423."
            )
            print("Updated P198: 2-minute elevator pitch attack 5")

    # 2. Update Tables
    # Table 37: Audit Page Operator Actions
    t37 = doc.tables[37]
    t37.rows[0].cells[0].text = (
        "EXACT OPERATOR ACTIONS [DO THIS LIVE]:\n"
        "Step 1: Click 'Audit Logs' in the sidebar or navigate to http://127.0.0.1:5173/audit.\n"
        "Step 2: Point to the 'DEMO LEDGER (ISOLATED)' badge and the 40 cryptographically sealed events. Explain that the demo runs in data/demo/ without polluting production.\n"
        "Step 3: Point to the 'Tamper Attack Testing Guide' card and click 'Show me how to attack it' to display the copyable terminal commands (tools/attack_demo.py).\n"
        "Step 4: Point to the 'Reset Demo Ledger' button: show how any demo testing can be instantly and idempotently re-seeded to 40 clean events.\n"
        "Step 5: Click 'Export Anchor' to demonstrate how an external auditor can export audit_anchor.json with its cryptographic head signature."
    )
    style_cell(t37.rows[0].cells[0], bg_color="F0FDF4", border_color="16A34A")
    print("Updated Table 37: Audit actions")

    # Table 39: Reality Check / Simulate Row Tamper
    t39 = doc.tables[39]
    t39.rows[0].cells[0].text = (
        "REALITY CHECK & ATTACK SCRIPT WORKFLOW:\n"
        "In Clarix AI, in-app 'tamper' buttons that edit the database from inside the web UI have been completely removed, "
        "because real threat actors attack via the OS and sqlite3, not via UI buttons. Tamper testing is executed via the external standalone script "
        "'python tools/attack_demo.py', which strictly refuses to run on production databases. In the UI, the Attack Guide explains the seven attack vectors, "
        "and the 'Show me how to attack it' box allows copying exact terminal commands. The demo ledger is strictly isolated in 'data/demo/clarix.db' "
        "and can be reseeded at any time using the 'Reset Demo Ledger' button."
    )
    style_cell(t39.rows[0].cells[0], bg_color="FFFBEB", border_color="D97706")
    print("Updated Table 39: Reality check / attack script")

    # Table 40: Integrity Page Operator Actions
    t40 = doc.tables[40]
    t40.rows[0].cells[0].text = (
        "EXACT OPERATOR ACTIONS [DO THIS LIVE]:\n"
        "Step 1: Click 'SHA-256 Integrity' in the sidebar or navigate to http://127.0.0.1:5173/integrity.\n"
        "Step 2: Point to the Status badge: 'SYSTEM INTEGRITY: VERIFIED' and the DEMO LEDGER badge.\n"
        "Step 3: Point to the 'Attacker View vs Clarix View' live comparison card, explaining why naive SHA-256 verifiers are blind to downstream rehashes.\n"
        "Step 4: Walk through the 90-Second Demo checklist on screen: Step 1 (clean baseline), Step 2 (attack_demo.py --list), Step 3 (attack_demo.py --edit-row 14 --rehash), Step 4 (attack_demo.py --legacy-verify passes clean), Step 5 (Clarix locks down in < 2.5s), Step 6 (chat returns HTTP 423), Step 7 (recovery with 20+ char reason)."
    )
    style_cell(t40.rows[0].cells[0], bg_color="F0FDF4", border_color="16A34A")
    print("Updated Table 40: Integrity actions")

    # Table 52: Question 5
    t52 = doc.tables[52]
    t52.rows[0].cells[0].text = (
        "IF A JUDGE ASKS: \"How do you prove that logs weren't edited by someone with admin access to the database?\"\n"
        "Confident Answer: Clarix provides a 4-layer tamper-evident defense. First, SQLite triggers 'audit_no_update' and 'audit_no_delete' raise database engine exceptions on any direct modification. Second, every event is sealed into a backward-linked HMAC-SHA256 chain using an air-gapped key ('audit.key') stored outside the database with strict 0600 permissions. Third, every commit signs an external anchor ('audit_anchor.json') storing the exact block count and head hash. Fourth, continuous background integrity checking monitors all four layers every 2.5 seconds and enforces POL-006 Fail-Closed Lockdown upon any discrepancy."
    )
    style_cell(t52.rows[0].cells[0], bg_color="EFF6FF", border_color="2563EB")
    print("Updated Table 52: Question 5")

    # Add the two new Judge Q&As after Table 52
    # We can add new tables at the end or right after Table 52
    q_rehash_text = (
        "IF A JUDGE ASKS: \"What if an attacker recalculates all SHA-256 hashes downstream after modifying an audit event?\"\n"
        "Confident Answer: That is the exact 'smart attacker' attack we demonstrate live in our 90-second demo with 'python tools/attack_demo.py --edit-row 14 --rehash'. Because plain SHA-256 is an unkeyed function, naive hash-chain verifiers will report that the rehashed chain is 100% valid. But Clarix does not use plain SHA-256: we use keyed HMAC-SHA256 where every block's digest requires 'audit.key'. Since the attacker does not possess the secret key, their recomputed hashes fail HMAC validation. Furthermore, the rehashed head hash does not match our external signed anchor file ('audit_anchor.json'), so the attack is caught instantly within 2.5 seconds."
    )
    q_root_text = (
        "IF A JUDGE ASKS: \"What if an attacker has root access to the entire operating system?\"\n"
        "Confident Answer: In an air-gapped defense deployment, root access is mitigated through defense-in-depth:\n"
        "1. Air-gap isolation guarantees no remote exfiltration channels exist.\n"
        "2. The external cryptographic anchor ('audit_anchor.json') can be written to a write-once WORM drive, HSM, or physically isolated serial audit printer.\n"
        "3. Cryptographic security state signatures over policies, tools, and triggers are validated on every request.\n"
        "4. If a root attacker corrupts or wipes the database, key, or anchor, Clarix fails closed: it immediately terminates all agent execution, blocks HTTP endpoints with 423 Locked, and refuses to serve requests. A compromised host cannot produce a validly signed audit chain or forge valid operator recoveries."
    )

    # Insert two new tables before Section 8
    # Find paragraph of Section 8
    p_sec8 = None
    for p in doc.paragraphs:
        if "Section 8: 'If Something Breaks Live'" in p.text:
            p_sec8 = p
            break

    # Add tables to document
    t_rehash = doc.add_table(rows=1, cols=1)
    t_rehash.rows[0].cells[0].text = q_rehash_text
    style_cell(t_rehash.rows[0].cells[0], bg_color="EFF6FF", border_color="2563EB")

    t_root = doc.add_table(rows=1, cols=1)
    t_root.rows[0].cells[0].text = q_root_text
    style_cell(t_root.rows[0].cells[0], bg_color="EFF6FF", border_color="2563EB")

    # If p_sec8 exists, move the xml elements of the tables before p_sec8
    if p_sec8:
        p_sec8._p.addprevious(t_rehash._tbl)
        p_sec8._p.addprevious(t_root._tbl)
        print("Inserted 2 new Judge Q&A tables before Section 8!")

    doc.save(DOCX_PATH)
    print(f"Successfully saved updated {DOCX_PATH}!")

if __name__ == "__main__":
    update_document()
