import os
import json
import uuid
import math
from typing import List, Dict, Any, Optional
from datetime import datetime
from .models import (
    EvidenceDocument,
    EvidenceChunk,
    StructuredFact,
    ContentAsset,
    Claim,
    ReviewTask,
    AuditLogEntry,
    ChangeImpactResult
)

# In-Memory / Local Storage state with seed-restoration capabilities
class ProoflineDB:
    def __init__(self):
        self.documents: Dict[str, EvidenceDocument] = {}
        self.chunks: List[EvidenceChunk] = []
        self.facts: Dict[str, StructuredFact] = {}
        self.assets: Dict[str, ContentAsset] = {}
        self.claims: Dict[str, Claim] = {}
        self.impact_events: List[Dict[str, Any]] = []
        self.review_tasks: Dict[str, ReviewTask] = {}
        self.audit_log: List[AuditLogEntry] = []

    def reset(self):
        self.documents.clear()
        self.chunks.clear()
        self.facts.clear()
        self.assets.clear()
        self.claims.clear()
        self.impact_events.clear()
        self.review_tasks.clear()
        self.audit_log.clear()

    # --- Evidence Documents ---
    def add_document(self, doc: EvidenceDocument) -> EvidenceDocument:
        self.documents[doc.id] = doc
        return doc

    def get_document(self, doc_id: str) -> Optional[EvidenceDocument]:
        return self.documents.get(doc_id)

    def list_documents(self) -> List[EvidenceDocument]:
        return list(self.documents.values())

    # --- Evidence Chunks & Vector Search ---
    def add_chunks(self, chunks: List[EvidenceChunk]):
        self.chunks.extend(chunks)

    def search_chunks(self, query_vector: Optional[List[float]], query_text: str, top_k: int = 3) -> List[EvidenceChunk]:
        """
        Retrieves top_k matching chunks.
        Uses cosine similarity if vectors are provided, else keyword/token overlap.
        """
        if not self.chunks:
            return []

        def cosine_similarity(v1: List[float], v2: List[float]) -> float:
            dot = sum(a * b for a, b in zip(v1, v2))
            norm1 = math.sqrt(sum(a * a for a in v1))
            norm2 = math.sqrt(sum(b * b for b in v2))
            if norm1 == 0 or norm2 == 0:
                return 0.0
            return dot / (norm1 * norm2)

        scored_chunks = []
        q_tokens = set(query_text.lower().split())

        for chunk in self.chunks:
            score = 0.0
            if query_vector and chunk.embedding:
                score = cosine_similarity(query_vector, chunk.embedding)
            else:
                chunk_tokens = set(chunk.passage_text.lower().split())
                if chunk_tokens:
                    overlap = len(q_tokens.intersection(chunk_tokens))
                    score = overlap / len(chunk_tokens)
            scored_chunks.append((score, chunk))

        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        return [c for _, c in scored_chunks[:top_k]]

    # --- Structured Facts ---
    def add_or_update_fact(self, fact: StructuredFact) -> StructuredFact:
        self.facts[fact.id] = fact
        return fact

    def get_fact(self, fact_id: str) -> Optional[StructuredFact]:
        return self.facts.get(fact_id)

    def get_fact_by_key(self, fact_key: str) -> Optional[StructuredFact]:
        for f in self.facts.values():
            if f.fact_key == fact_key:
                return f
        return None

    def list_facts(self) -> List[StructuredFact]:
        return list(self.facts.values())

    # --- Content Assets ---
    def add_or_update_asset(self, asset: ContentAsset) -> ContentAsset:
        self.assets[asset.id] = asset
        return asset

    def get_asset(self, asset_id: str) -> Optional[ContentAsset]:
        return self.assets.get(asset_id)

    def list_assets(self) -> List[ContentAsset]:
        return list(self.assets.values())

    # --- Claims ---
    def add_claim(self, claim: Claim) -> Claim:
        self.claims[claim.id] = claim
        return claim

    def get_claims_by_asset(self, asset_id: str) -> List[Claim]:
        return [c for c in self.claims.values() if c.asset_id == asset_id]

    def list_claims(self) -> List[Claim]:
        return list(self.claims.values())

    # --- Review Tasks ---
    def add_task(self, task: ReviewTask) -> ReviewTask:
        self.review_tasks[task.id] = task
        return task

    def get_task(self, task_id: str) -> Optional[ReviewTask]:
        return self.review_tasks.get(task_id)

    def list_tasks(self, status: Optional[str] = None, role: Optional[str] = None) -> List[ReviewTask]:
        results = list(self.review_tasks.values())
        if status:
            results = [t for t in results if t.status == status]
        if role and role != "admin":
            effective_role = "reviewer" if role == "legal_compliance" else role
            results = [t for t in results if t.assigned_role in [effective_role, role]]
        return results

    # --- Audit Log ---
    def record_audit(
        self,
        actor: str,
        role: str,
        action: str,
        target_entity: str,
        target_id: Optional[str] = None,
        diff_payload: Optional[Dict[str, Any]] = None,
        notes: Optional[str] = None
    ) -> AuditLogEntry:
        entry = AuditLogEntry(
            id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
            timestamp=datetime.utcnow().isoformat() + "Z",
            actor=actor,
            actor_role=role,
            action=action,
            target_entity=target_entity,
            target_id=target_id,
            diff_payload=diff_payload or {},
            notes=notes
        )
        self.audit_log.insert(0, entry)
        return entry

    def list_audit_logs(self, limit: int = 50) -> List[AuditLogEntry]:
        return self.audit_log[:limit]

# Singleton instance
db = ProoflineDB()
