"""Encrypted Agent Memory Store with injection scanning and taint tracking."""
from __future__ import annotations

import base64
import time
import uuid
from typing import Any

from ..errors import bad_request, forbidden
from ..security import injection


class AgentMemoryStore:
    """
    Encrypted Local Working Memory and Long-Term Notes (POL-008).
    - Encrypted at rest via AES-256 / Fernet envelope encryption.
    - Scanned for prompt injection on both write and read.
    - Inherits and propagates classification labels and taint context.
    - Fully audited (store, recall, clear).
    - Can be cleared on demand ('Forget').
    """

    def __init__(self, ctx):
        self.ctx = ctx

    def store(
        self,
        session_id: str,
        key: str,
        content: str,
        classification: str = "INTERNAL",
        actor: str = "operator",
    ) -> dict[str, Any]:
        """Store an encrypted memory item under a session and key."""
        # 1. Enforce POL-008
        if hasattr(self.ctx, "policy") and "POL-008" not in self.ctx.policy.enabled():
            raise forbidden("Agent Memory policy (POL-008) is disabled. Memory write rejected.")

        content_str = (content or "").strip()
        if not content_str:
            raise bad_request("Memory content cannot be empty")

        # 2. Ingress injection scan on write
        scan = injection.scan(content_str, "AGENT_MEMORY")
        if scan.decision == "BLOCK":
            self.ctx.threats.record(
                category=scan.category,
                input_text=content_str[:500],
                reason=f"Memory injection attempt: {scan.reason}",
                risk=scan.risk,
                status="BLOCKED",
                source="agent_memory",
                timeline=[
                    {"step": "Ingress", "detail": "Memory item presented for storage", "ok": True},
                    {"step": "Scan", "detail": f"Injection scan detected: {scan.category}", "ok": False},
                    {"step": "Policy", "detail": "Rejected write to encrypted agent memory", "ok": False},
                ],
            )
            self.ctx.audit.append(
                user=actor,
                action="Blocked memory injection attempt",
                component="Agent Memory",
                risk=scan.risk_label,
                decision="BLOCK",
                classification=classification,
                payload=f"memory:write:blocked:{scan.category}",
            )
            raise bad_request(f"Memory write blocked: {scan.reason}")

        # 3. Encrypt data via CryptoStorage envelope encryption
        raw_bytes = content_str.encode("utf-8")
        encrypted_bytes = self.ctx.crypto.encrypt(raw_bytes)
        blob_b64 = base64.b64encode(encrypted_bytes).decode("ascii")

        now = time.time()
        existing = self.ctx.db.q(
            "SELECT id FROM agent_memory WHERE session_id = ? AND key = ?",
            (session_id, key),
        )
        if existing:
            mem_id = existing[0]["id"]
            self.ctx.db.x(
                "UPDATE agent_memory SET encrypted_blob = ?, classification = ?, updated_at = ? WHERE id = ?",
                (blob_b64, classification.upper(), now, mem_id),
            )
        else:
            mem_id = f"mem_{uuid.uuid4().hex[:12]}"
            self.ctx.db.x(
                "INSERT INTO agent_memory(id, session_id, key, encrypted_blob, classification, created_at, updated_at) "
                "VALUES(?,?,?,?,?,?,?)",
                (mem_id, session_id, key, blob_b64, classification.upper(), now, now),
            )

        # 4. Audit ledger (never stores raw memory text)
        self.ctx.audit.append(
            user=actor,
            action="Agent Memory Stored",
            component="Agent Memory",
            risk="LOW",
            decision="ALLOW",
            classification=classification.upper(),
            payload=f"memory:store:{mem_id}:{key}:len={len(content_str)}",
        )

        return {
            "id": mem_id,
            "sessionId": session_id,
            "key": key,
            "classification": classification.upper(),
            "length": len(content_str),
            "updatedAt": now,
        }

    def recall(
        self,
        session_id: str,
        key: str | None = None,
        actor: str = "operator",
    ) -> list[dict[str, Any]]:
        """Recall and decrypt stored memories for a session, checking for injections."""
        if hasattr(self.ctx, "policy") and "POL-008" not in self.ctx.policy.enabled():
            raise forbidden("Agent Memory policy (POL-008) is disabled. Memory recall rejected.")

        if key:
            rows = self.ctx.db.q(
                "SELECT id, session_id, key, encrypted_blob, classification, updated_at FROM agent_memory "
                "WHERE session_id = ? AND key = ? ORDER BY updated_at ASC",
                (session_id, key),
            )
        else:
            rows = self.ctx.db.q(
                "SELECT id, session_id, key, encrypted_blob, classification, updated_at FROM agent_memory "
                "WHERE session_id = ? ORDER BY updated_at ASC",
                (session_id,),
            )

        items = []
        for r in rows:
            try:
                raw_enc = base64.b64decode(r["encrypted_blob"])
                dec = self.ctx.crypto.decrypt(raw_enc).decode("utf-8", errors="replace")
            except Exception:
                dec = "[decryption error: unable to decrypt memory item]"

            # Egress injection scan on read
            scan = injection.scan(dec, "AGENT_MEMORY_RECALL")
            tainted = False
            if scan.decision == "BLOCK":
                tainted = True
                dec = f"[REDACTED_INJECTION_PATTERN: {scan.category}]"

            items.append({
                "id": r["id"],
                "sessionId": r["session_id"],
                "key": r["key"],
                "content": dec,
                "classification": r["classification"],
                "updatedAt": r["updated_at"],
                "tainted": tainted,
            })

        self.ctx.audit.append(
            user=actor,
            action="Agent Memory Recalled",
            component="Agent Memory",
            risk="LOW",
            decision="ALLOW",
            classification="INTERNAL",
            payload=f"memory:recall:{session_id}:count={len(items)}",
        )
        return items

    def clear(
        self,
        session_id: str | None = None,
        key: str | None = None,
        actor: str = "operator",
    ) -> int:
        """Clear memory ('Forget' action)."""
        if session_id and key:
            cur = self.ctx.db.x(
                "DELETE FROM agent_memory WHERE session_id = ? AND key = ?",
                (session_id, key),
            )
        elif session_id:
            cur = self.ctx.db.x(
                "DELETE FROM agent_memory WHERE session_id = ?",
                (session_id,),
            )
        else:
            cur = self.ctx.db.x("DELETE FROM agent_memory")

        deleted = cur.rowcount if hasattr(cur, "rowcount") else 0

        self.ctx.audit.append(
            user=actor,
            action="Agent Memory Cleared (Forget)",
            component="Agent Memory",
            risk="LOW",
            decision="ALLOW",
            classification="INTERNAL",
            payload=f"memory:clear:session={session_id}:key={key}:deleted={deleted}",
        )
        return deleted

    def list_items(self, session_id: str | None = None) -> list[dict[str, Any]]:
        """List metadata of stored memories without revealing encrypted contents."""
        if session_id:
            rows = self.ctx.db.q(
                "SELECT id, session_id, key, classification, length(encrypted_blob) as blen, created_at, updated_at "
                "FROM agent_memory WHERE session_id = ? ORDER BY updated_at DESC",
                (session_id,),
            )
        else:
            rows = self.ctx.db.q(
                "SELECT id, session_id, key, classification, length(encrypted_blob) as blen, created_at, updated_at "
                "FROM agent_memory ORDER BY updated_at DESC"
            )

        return [
            {
                "id": r["id"],
                "sessionId": r["session_id"],
                "key": r["key"],
                "classification": r["classification"],
                "encryptedBytes": r["blen"],
                "createdAt": r["created_at"],
                "updatedAt": r["updated_at"],
            }
            for r in rows
        ]
