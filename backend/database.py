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
        self.fact_history: List[Dict[str, Any]] = []

    def reset(self):
        self.documents.clear()
        self.chunks.clear()
        self.facts.clear()
        self.assets.clear()
        self.claims.clear()
        self.impact_events.clear()
        self.review_tasks.clear()
        self.audit_log.clear()
        self.fact_history.clear()

    # --- Evidence Documents ---
    def add_document(self, doc: EvidenceDocument) -> EvidenceDocument:
        self.documents[doc.id] = doc
        return doc

    def get_document(self, doc_id: str, organization_id: Optional[str] = None) -> Optional[EvidenceDocument]:
        document = self.documents.get(doc_id)
        if document and (organization_id is None or document.organization_id == organization_id):
            return document
        return None

    def list_documents(self, organization_id: Optional[str] = None) -> List[EvidenceDocument]:
        return [
            document for document in self.documents.values()
            if organization_id is None or document.organization_id == organization_id
        ]

    # --- Evidence Chunks & Vector Search ---
    def add_chunks(self, chunks: List[EvidenceChunk]):
        self.chunks.extend(chunks)

    def search_chunks(
        self,
        query_vector: Optional[List[float]],
        query_text: str,
        top_k: int = 3,
        organization_id: Optional[str] = None,
    ) -> List[EvidenceChunk]:
        """
        Retrieves top_k matching chunks.
        Uses cosine similarity if vectors are provided, else keyword/token overlap.
        """
        chunks = [
            chunk for chunk in self.chunks
            if organization_id is None or chunk.organization_id == organization_id
        ]
        if not chunks:
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

        for chunk in chunks:
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

    def get_fact(self, fact_id: str, organization_id: Optional[str] = None) -> Optional[StructuredFact]:
        fact = self.facts.get(fact_id)
        if fact and (organization_id is None or fact.organization_id == organization_id):
            return fact
        return None

    def get_fact_by_key(self, fact_key: str, organization_id: Optional[str] = None) -> Optional[StructuredFact]:
        for f in self.facts.values():
            if f.fact_key == fact_key and (organization_id is None or f.organization_id == organization_id):
                return f
        return None

    def list_facts(self, organization_id: Optional[str] = None) -> List[StructuredFact]:
        return [
            fact for fact in self.facts.values()
            if organization_id is None or fact.organization_id == organization_id
        ]

    def record_fact_version(self, fact: StructuredFact, actor: str) -> None:
        self.fact_history.append({
            "fact": fact.dict(),
            "recorded_at": datetime.utcnow().isoformat() + "Z",
            "recorded_by": actor,
            "organization_id": fact.organization_id,
        })

    def list_fact_history(self, organization_id: Optional[str] = None) -> List[Dict[str, Any]]:
        return [
            entry for entry in self.fact_history
            if organization_id is None or entry.get("organization_id") == organization_id
        ]

    # --- Content Assets ---
    def add_or_update_asset(self, asset: ContentAsset) -> ContentAsset:
        self.assets[asset.id] = asset
        return asset

    def get_asset(self, asset_id: str, organization_id: Optional[str] = None) -> Optional[ContentAsset]:
        asset = self.assets.get(asset_id)
        if asset and (organization_id is None or asset.organization_id == organization_id):
            return asset
        return None

    def list_assets(self, organization_id: Optional[str] = None) -> List[ContentAsset]:
        return [
            asset for asset in self.assets.values()
            if organization_id is None or asset.organization_id == organization_id
        ]

    # --- Claims ---
    def add_claim(self, claim: Claim) -> Claim:
        self.claims[claim.id] = claim
        return claim

    def get_claims_by_asset(
        self,
        asset_id: str,
        organization_id: Optional[str] = None,
    ) -> List[Claim]:
        return [
            claim for claim in self.claims.values()
            if claim.asset_id == asset_id
            and (organization_id is None or claim.organization_id == organization_id)
        ]

    def delete_claims_by_asset(
        self,
        asset_id: str,
        organization_id: Optional[str] = None,
    ) -> None:
        self.claims = {
            claim_id: claim for claim_id, claim in self.claims.items()
            if claim.asset_id != asset_id
            or (organization_id is not None and claim.organization_id != organization_id)
        }

    def list_claims(self, organization_id: Optional[str] = None) -> List[Claim]:
        return [
            claim for claim in self.claims.values()
            if organization_id is None or claim.organization_id == organization_id
        ]

    # --- Review Tasks ---
    def add_task(self, task: ReviewTask) -> ReviewTask:
        self.review_tasks[task.id] = task
        return task

    def get_task(self, task_id: str, organization_id: Optional[str] = None) -> Optional[ReviewTask]:
        task = self.review_tasks.get(task_id)
        if task and (organization_id is None or task.organization_id == organization_id):
            return task
        return None

    def list_tasks(
        self,
        status: Optional[str] = None,
        role: Optional[str] = None,
        organization_id: Optional[str] = None,
    ) -> List[ReviewTask]:
        results = [
            task for task in self.review_tasks.values()
            if organization_id is None or task.organization_id == organization_id
        ]
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
        notes: Optional[str] = None,
        organization_id: Optional[str] = None,
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
            notes=notes,
            organization_id=organization_id,
        )
        self.audit_log.insert(0, entry)
        return entry

    def list_audit_logs(self, limit: int = 50, organization_id: Optional[str] = None) -> List[AuditLogEntry]:
        scoped_logs = [
            entry for entry in self.audit_log
            if organization_id is None or entry.organization_id == organization_id
        ]
        return scoped_logs[:limit]

# Singleton instance
db = ProoflineDB()
