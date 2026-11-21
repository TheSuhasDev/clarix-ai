# Clarix AI — 90-Second Tamper Lockdown Demo Script
*Audience: Competition Judges & Technical Evaluators*  
*Presenter: Suhas (BMS Institute of Technology and Management)*  
*Target Duration: 90 Seconds*

---

## Overview

Most AI security demos show input guardrails blocking bad prompts. But in a real enterprise or defence deployment, **threat actors attack the underlying database directly using `sqlite3`**, bypassing the web application entirely to rewrite audit logs, elevate tool permissions, or disable security policies.

In this demo, you prove live that **naive SHA-256 hash chains fail against smart attackers**, whereas Clarix AI's 4-layer defense (**Keyed HMAC-SHA256 + External Cryptographic Anchor + Signed Security State + Fail-Closed Lockdown under POL-006**) catches the attack in under 3 seconds and completely halts operations.

---

## Pre-Demo Checklist
1. Ensure the backend daemon is running in demo mode (`CLARIX_DEMO_MODE=1`).
2. Open the browser to `http://127.0.0.1:5173/integrity` and have a terminal open to `c:\Users\suhas\Desktop\clarix-ai`.
3. If needed, click **"Reset Demo Ledger"** on the Audit or Integrity page to restore 40 clean seed events.

---

## 7-Step 90-Second Demo Walkthrough

### Step 1: Baseline Check — Show the Clean Cryptographic Ledger (10s)
- **Action:** Open the **Integrity** page (`/integrity`).
- **Spoken Script:**
  > *"Judges, right now Clarix AI is running in an air-gapped environment. On this screen, you can see our audit ledger with 40 cryptographically sealed events. Every single inference, tool call, policy gate, and exfiltration block is committed into a backward-linked chain. All four verification layers are green: HMAC chain, external anchor, signed security state, and database triggers. Now, let's attack it like a real adversary."*

---

### Step 2: Open Terminal & Inspect Events (10s)
- **Action:** Switch to terminal and run:
  ```powershell
  python tools/attack_demo.py --list
  ```
- **Spoken Script:**
  > *"Notice we are NOT clicking an in-app 'tamper' button. In production, no hacker uses an application button. We run our external CLI attack tool, editing the SQLite database directly from the operating system just like an attacker with local file access would."*

---

### Step 3: Execute the "Smart Adversary" Attack (15s)
- **Action:** Run the smart row alteration + downstream rehash command:
  ```powershell
  python tools/attack_demo.py --edit-row 14 --rehash
  ```
- **Spoken Script:**
  > *"Event 14 was a blocked data exfiltration attempt. We just edited it in SQLite from `BLOCK` to `ALLOW` to hide malicious activity. But a naive hacker leaves broken hashes. A smart attacker recalculates every single downstream SHA-256 hash in the chain. Watch the terminal: all 26 subsequent blocks have been re-computed with valid SHA-256 parent links."*

---

### Step 4: Prove Legacy Verifier Blindness (15s)
- **Action:** Run the naive unkeyed verification tool:
  ```powershell
  python tools/attack_demo.py --legacy-verify
  ```
- **Spoken Script:**
  > *"Now we run a standard, legacy SHA-256 verifier—the kind taught in ordinary tutorials and naive blockchain demos. Look at the result: it prints 'ALL 40 EVENTS VALID. ZERO TAMPER DETECTED.' The legacy verifier is 100% blind to this attack because the hash links appear unbroken. Any system relying only on plain SHA-256 would give you false confidence."*

---

### Step 5: Clarix Instant Tamper Detection & Side-by-Side View (15s)
- **Action:** Switch back to the browser window. Within 2.5 seconds, the background checker catches the discrepancy and triggers the red full-screen lockdown.
- **Spoken Script:**
  > *"Now look at Clarix AI. In less than 3 seconds, our continuous integrity checker detected the tamper. On the left is the attacker's view: green and smiling. On the right is Clarix: instant RED ALERT. Why? Because the attacker didn't have our air-gapped HMAC secret key (`audit.key`), and the rehashed head doesn't match our external cryptographic anchor."*

---

### Step 6: Fail-Closed Lockdown Verification (15s)
- **Action:** Click "Inspect Logs (Read-Only)" on the overlay or try sending a chat message in `/agent`.
- **Spoken Script:**
  > *"Notice Clarix doesn't just display a warning. Under security policy POL-006, the entire system enters fail-closed lockdown. The chat returns HTTP 423 Locked. Tool execution, document ingestion, and policy changes are completely frozen. The compromised system cannot be used for any further operations until an administrator formally intervenes."*

---

### Step 7: Cryptographic Incident Recovery (10s)
- **Action:** Click **"Start Recovery"**, enter an admin justification of 20+ characters (e.g. `Investigated out-of-band edit on event 14; rebaselining verified state`), type `I CONFIRM REBASELINE OF SECURITY STATE`, and click **Unlock System**.
- **Spoken Script:**
  > *"To recover, the administrator must authenticate and enter a mandatory 20+ character security justification with an explicit confirmation phrase. Clarix creates a signed incident block in the ledger, recalculates the HMAC chain, signs the new anchor, and unlocks the system. The tamper attempt and the recovery are permanently immortalized in the audit trail."*

---

## Quick Reference Table for Judges

| Attack Scenario | Legacy SHA-256 Verifier | Clarix Keyed + Anchored (POL-006) | Detection Latency | Detection Mechanism |
| :--- | :---: | :---: | :---: | :--- |
| **1. Edit Row (Raw)** | ❌ BROKEN | 🛑 TAMPER DETECTED | **< 2.5s** | HMAC signature mismatch on modified row |
| **2. Edit Row + Rehash** | ⚠️ **VALID (Blind)** | 🛑 **TAMPER DETECTED** | **< 2.5s** | Keyed HMAC failure + External head anchor mismatch |
| **3. Truncate Tail** | ⚠️ **VALID (Blind)** | 🛑 **TAMPER DETECTED** | **< 2.5s** | Event count < anchor.count and head hash divergence |
| **4. Forge Injected Row** | ❌ BROKEN | 🛑 **TAMPER DETECTED** | **< 2.5s** | Missing valid HMAC signature generated by `audit.key` |
| **5. Rollback Database** | ⚠️ **VALID (Blind)** | 🛑 **TAMPER DETECTED** | **< 2.5s** | Sequence monotonicity drop & stale external anchor |
| **6. Elevate Tool Level** | ⚠️ **IGNORED** | 🛑 **TAMPER DETECTED** | **< 2.5s** | Signed security state mismatch (`tool_permissions`) |
| **7. Disable Policy (DB)** | ⚠️ **IGNORED** | 🛑 **TAMPER DETECTED** | **< 2.5s** | Signed security state mismatch (`policies`) |
| **8. Drop SQLite Trigger**| ⚠️ **IGNORED** | 🛑 **TAMPER DETECTED** | **< 2.5s** | Trigger presence probe flags missing `audit_no_update` |

---

## Common Judge Questions & Answers

### Q1: "What if an attacker recalculates all SHA-256 hashes downstream?"
**Answer:**
> *"That is precisely what we just demonstrated in Step 3! In a naive SHA-256 hash chain, recalculating downstream hashes works because SHA-256 is an unkeyed function. But Clarix uses HMAC-SHA256 with an air-gapped cryptographic key stored outside the database (`audit.key` with strict 0600 filesystem permissions). Because the attacker does not possess the key, any recomputed hash produces an invalid signature. Furthermore, Clarix commits the head hash to an external anchor file, so even if an attacker fabricated new hashes, the head hash would not match the anchor."*

### Q2: "What if the attacker has root / administrator access to the entire host?"
**Answer:**
> *"Clarix is designed for defence-in-depth in air-gapped environments. Even with root access:
> 1. SQLite database triggers immediately abort direct UPDATE and DELETE queries at the engine level.
> 2. The external anchor is written to a designated immutable or write-once append-only medium (e.g. read-only mount, HSM, or physically isolated serial logger).
> 3. Security state digests are cryptographically verified upon every single request.
> 4. If an attacker tampers with or deletes the anchor or database, Clarix fails closed: it refuses to serve inferences or execute tools. A compromised host cannot produce a validly signed audit chain."*
