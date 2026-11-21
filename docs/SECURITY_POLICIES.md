# Clarix AI — Zero-Trust Security Policies Specification

## 1. Classification & Taint Taxonomy

Clarix assigns a security classification tag to all ingress prompts, documents, tool outputs, and execution contexts:

| Classification | Sensitivity | Retrieval Requirements | Sink Constraints |
|---|---|---|---|
| `PUBLIC` | Open information | Direct access permitted | Permitted to all local tools |
| `INTERNAL` | Standard organizational assets | Permitted to authenticated operators | Blocked from external sinks |
| `CONFIDENTIAL` | Sensitive operational data | **Requires Human Approval** to view/read | Blocked from all external sinks; taint strictly tracked |
| `RESTRICTED` | Critical secrets / crown jewels | **Requires Human Approval**; tools disabled | Strictly isolated; zero exfiltration allowance |

---

## 2. Policy Definitions

### POL-001: Air-Gap Isolation
- **Domain**: Network
- **Objective**: Guarantees zero unauthorized outbound or inbound network traffic.
- **Rules**:
  1. Deny all outbound TCP/UDP socket creation to non-loopback destinations.
  2. In-process guard raises `AirGapViolation` before DNS resolution or packet transmission.
  3. External URLs in tool arguments or model proposals trigger immediate `BLOCK`.
  4. Blocked attempts are recorded to `blocked_connections` and committed to the audit ledger.
  5. Continuous Host Egress Watch daemon (`NetworkMonitor`) samples OS TCP socket tables every 5 seconds to detect any external sockets owned by Clarix processes.
  6. In `enforce` mode (`CLARIX_EGRESS_WATCH_MODE=enforce`), unauthorized external socket creation immediately triggers a POL-006 cryptographic lockdown and logs a critical security alert to the SHA-256 HMAC ledger. In `warn` mode (default in dev), alerts are committed to audit without locking down.

### POL-002: Sensitive File Protection
- **Domain**: Data / Storage
- **Objective**: Confines all file operations strictly to the authorized workspace sandbox.
- **Rules**:
  1. Paths are resolved and normalized; traversal sequences (`..`) and symlink escapes outside the workspace are blocked.
  2. Access to credential files, system files (`/etc`, `C:\Windows`), and `.env` is blocked unconditionally.
  3. Files classified `CONFIDENTIAL` or `RESTRICTED` require human approval before reading.
  4. Ingested files are written encrypted at rest with AES-256 envelope encryption.

### POL-003: Tool Least Privilege
- **Domain**: Tool Execution
- **Objective**: Enforces strict capability boundaries on all tool invocation proposals.
- **Rules**:
  1. Tools assigned `DISABLED` or `BLOCKED` status can never run under any condition.
  2. `RESTRICTED` tools (such as CLI shell inspection) require human approval for every single execution.
  3. Calculators run in an `ast` parse tree with whitelisted arithmetic operators only (no `eval`).
  4. Database queries run in read-only mode with SQLite authorizer callbacks that restrict accessible tables and hide vector embeddings.

### POL-004: Human Approval for High-Risk Actions
- **Domain**: Human-in-the-Loop
- **Objective**: Suspends high-risk or classified actions until an authenticated human operator approves.
- **Rules**:
  1. Actions returning `REQUIRE_APPROVAL` enter an atomic compare-and-set state queue.
  2. The pending action (tool, argument, requester, taint level) is serialized and frozen.
  3. Requests expire automatically after 300 seconds if unhandled.
  4. Approving resumes the exact frozen action, re-evaluating policy at resumption time.

### POL-005: Prevent External Data Transfer & Exfiltration
- **Domain**: Data Loss Prevention
- **Objective**: Prevents tainted data from escaping to sinks.
- **Rules**:
  1. If the current `TaintContext` carries `CONFIDENTIAL` or `RESTRICTED` tags, invocations of communication sinks (email, network, curl) are halted deterministically.
  2. Tool outputs are scanned for prompt injection attacks before being shown to the model.
  3. Model outputs undergo secret redaction (regex sanitization for keys, bearer tokens, passwords) before being rendered.

### POL-006: Cryptographic Integrity Lockdown
- **Domain**: Cryptographic Anti-Tamper & Fail-Closed Integrity
- **Objective**: Prevents out-of-band manipulation of the audit ledger, immutability triggers, security policies, or tool permissions. Enforces fail-closed lockdown if any tampering occurs.
- **Rules**:
  1. **Keyed Hash Chain (HMAC-SHA256)**: Events are chained with `HMAC-SHA256(key, prev_hash + canonical)` using a 32-byte secret (`audit.key`) stored strictly outside the SQLite database with 0600 permissions. Legacy SHA-256 chains are verified and upgraded seamlessly with a `CHAIN_UPGRADE` event.
  2. **External Cryptographic Anchor**: Every append writes a signed `{count, head_hash, timestamp, signature}` anchor file (`audit_anchor.json`) outside the database. Verification fails if database count is below anchor count, head hash differs, or events are inserted without updating the anchor.
  3. **Trigger Guard**: Periodically and before sensitive actions, Clarix verifies that `audit_no_update` and `audit_no_delete` triggers exist and enforce append-only immutability.
  4. **Signed Security State**: Computes an HMAC over canonical JSON of policies, tool permission levels, and document classifications. Direct database updates break the signature.
  5. **Continuous Verification (<10ms Fast Checks)**: Validates triggers, state signature, and external anchor before sensitive actions (`agent_chat`, `tool_execute`, `approval_resolve`, `rag_ingest`, `policy_patch`, `tool_permission`) and every 5 seconds in the background.
  6. **Fail-Closed Lockdown**: Discrepancies immediately engage fail-closed lockdown (`lockdown.json`), returning HTTP 423 `Locked` (`system_locked`) for all sensitive operations. Read-only audit inspection, health, and incident logs remain available. Incidents are recorded to a hash-chained `incidents.log`.
  7. **Operator Recovery**: Recovery requires administrative authentication:
     - `restore_snapshot`: Restores database from the latest verified snapshot (`snapshots/latest.db`).
     - `rebaseline`: Requires written justification and exact confirmation phrase `"I CONFIRM REBASELINE OF SECURITY STATE"`. Re-seals the audit chain, signs active state, anchors the head, and logs an audited `RECOVERY_REBASELINE` event.

#### Honest Root-Level Limitations (Threat Model)
- **Attacker without DB access**: 100% blocked, logged, and isolated.
- **Attacker with SQLite write access (no host root)**: Cannot forge valid HMAC blocks, alter policies/tools, truncate tail events, or drop triggers without detection. Detected within <10ms on next action or <5s background sweep.
- **Attacker with full host root access**: A host root attacker can read `audit.key`, rewrite both the database and `audit_anchor.json`, or modify Python binaries directly. For true defense against root compromise, Clarix provides `GET /api/integrity/anchor/export` to export the signed anchor out-of-band to a remote WORM (Write Once, Read Many) syslog server, hardware security module (HSM), or printed hardcopy ledger.

---

## 3. Cryptographic Audit Chain (Tamper-Evidence)

Every event is committed using an append-only hash chain:

$$H_0 = 0^{64}$$
$$H_i = \text{SHA-256}(H_{i-1} \parallel \text{canonical}(R_i))$$

Where $\text{canonical}(R_i)$ is the deterministic, key-sorted, whitespace-stripped JSON representation of all fields:
`id`, `timestamp`, `user`, `action`, `component`, `risk`, `decision`, `classification`, and `payload`.

SQLite database triggers strictly reject any `UPDATE` or `DELETE` on the `audit_events` table:
```sql
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_events
BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;

CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_events
BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;
```
