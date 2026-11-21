# Clarix AI — Competition Demo Checklist & Runbook

This checklist guides you step-by-step through setting up, verifying, and demonstrating Clarix AI for competition judges.

---

## 1. Pre-Flight Clean Setup

### Step 1.1: Verify Air-Gap & Dependencies
- Confirm workstation is fully offline or in air-gapped demo mode.
- Confirm local model is loaded in Ollama:
  ```powershell
  ollama list
  # Should show qwen3:4b
  ```
- Warm up the local model so first inference is instantaneous:
  ```powershell
  ollama run qwen3:4b "ping"
  ```

### Step 1.2: Prepare Clean Production Ledger (Fresh Install)
To ensure zero test data or development artifacts in the live ledger:
```powershell
python -m clarix --fresh-install --confirm "I CONFIRM FRESH INSTALL"
```
**Verification:**
1. Confirms existing DB, keys, and anchors are safely archived into `data/archive/<timestamp>/`.
2. Initializes fresh `data/clarix.db` with exactly 1 `SYSTEM_INSTALL` genesis event.
3. Generates a fresh 32-byte `data/audit.key` (0600) and signed `data/audit_anchor.json`.
4. Outputs: `Committed 1 genesis event: seq=1 ... Chain verification: VALID (OK)`.

---

## 2. Start Clarix AI Services

### Terminal 1: Backend Daemon
```powershell
cd c:\Users\suhas\Desktop\clarix-ai
$env:CLARIX_DEMO_MODE="1"
python -m clarix
```
*(Backend starts on `http://127.0.0.1:8000`)*

### Terminal 2: Frontend Console
```powershell
cd c:\Users\suhas\Desktop\clarix-ai\frontend
npm run dev
```
*(Frontend starts on `http://127.0.0.1:5173`)*

---

## 3. Demo Ledger Verification

1. Open `http://127.0.0.1:5173` in your browser.
2. Observe the persistent **Ledger Isolation Badge** in the top bar:
   - Amber badge: `DEMO LEDGER · clarix_demo.db (SANDBOX)`.
3. Navigate to `/audit`:
   - Click **Reset Demo Ledger (40 Events)**.
   - Confirm the audit table displays exactly **40 events** (seed ingestion, prompt injections, blocked exfiltrations, tool calls, approvals).
   - Confirm the production database `data/clarix.db` remains 100% byte-identical and untouched.

---

## 4. Judges Presentation Script: 7-Minute Tamper Lockdown Demo

### A. Show the Clean Ledger (1 minute)
1. Point out the audit trail on `/audit`:
   - Monospace timestamps, Event IDs, actors, actions, policies, and HMAC-SHA256 digests.
   - Click **Verify chain now**: shows instant cryptographic verification with latency in milliseconds.
   - Click any event row to open the **Record Details Modal**: inspect the canonical string, payload, and block hash.

### B. Launch External Out-of-Band Attack (2 minutes)
Open a new terminal window at the repo root and explain to the judges:
> *"An attacker with database access does not use our UI or API. They open SQLite directly on disk and modify rows."*

Run the smart rehash attack:
```powershell
python tools/attack_demo.py --edit-row 14 --rehash
```
**Explain what happened:**
- The attacker dropped the SQLite trigger `audit_no_update`.
- Changed Event 14 decision from `BLOCK` to `ALLOW` (tampering exfiltration records).
- Recalculated plain SHA-256 for every subsequent record so the parent-hash links are continuous.

### C. The Two-Verifier Comparison (2 minutes)
Run the legacy verifier:
```powershell
python tools/attack_demo.py --legacy-verify
```
**Show the judges:**
- Legacy Plain SHA-256 verifier reports: `VALID / CLEAN ✅`!
- **Key Insight:** Standard blockchain / SHA-256 audit ledgers without secret keys are vulnerable to full rehash attacks.

Now look at the Clarix UI:
- Within 2.5 seconds, the **POL-006 FAIL-CLOSED LOCKDOWN** modal engages full screen!
- Navigate to `/integrity`:
  - Show the **Side-by-Side Verifier Comparison Matrix**:
    - Left column: Legacy SHA-256 shows green `VALID` (blind to the attack).
    - Right column: Clarix POL-006 shows red `LOCKED` (HMAC key mismatch detected).

### D. Authorized Recovery & Post-Mortem (2 minutes)
1. In the Lockdown modal, click **Authorize Incident Recovery**.
2. Select **Rebaseline & Cryptographic Reseal**.
3. Enter justification (at least 20 chars):
   `Forensic audit complete; unauthorized tamper resolved by security operator.`
4. Type confirmation: `I CONFIRM REBASELINE`
5. Click **Execute Recovery**:
   - System unseals, re-anchors the chain, and logs a permanent `RECOVERY_REBASELINE` audit record.
   - UI instantly unlocks back to normal operational state.

### E. Reset to Ready State
1. In `/audit`, click **Reset Demo Ledger (40 Events)**.
2. System returns to a clean 40-event seed for the next round of questions!
