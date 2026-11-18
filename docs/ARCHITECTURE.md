# System Architecture & Data Model

Proofline is an evidence-backed brand-governance platform.  
**Tagline:** *"When facts change, know exactly what needs to change."*

---

## 1. Layered System Architecture

The Proofline platform is organized into four distinct, loosely coupled layers matching the Round 1 architectural commitment:

```
+-----------------------------------------------------------------------------------+
|                            EXPERIENCE LAYER (Next.js / React)                     |
|  • Responsive Web App (Tailwind CSS, Navy #0B1B33, Teal #2BC4C4, Amber #F5A623)   |
|  • Brand Governance Dashboard & Health Score Telemetry                            |
|  • Change Impact Visualizer (Interactive 3-Column Dependency Graph)               |
|  • Human Review Centre (Side-by-side Diff Viewer, Approve / Reject / Edit)        |
|  • Role Switcher Viewport (Admin, Legal Reviewer, Brand Manager, Content Creator) |
+-----------------------------------------------------------------------------------+
                                         |
                                         | REST / JSON APIs
                                         v
+-----------------------------------------------------------------------------------+
|                        APPLICATION LAYER (FastAPI / Python)                       |
|  • FastAPI REST Endpoints (Document upload, claim scan, fact change, reviews)     |
|  • Role-Based Access Control (Supabase Auth / JWT / Role Gate Enforcement)        |
|  • Asynchronous Background Jobs (FastAPI BackgroundTasks for MVP document parsing)|
|  • Audit Ledger Service (Chronological, immutable governance trail)               |
+-----------------------------------------------------------------------------------+
                                         |
                                         | Verification & Graph Queries
                                         v
+-----------------------------------------------------------------------------------+
|                         INTELLIGENCE LAYER (Hybrid Engine)                        |
|  • Claim Intelligence: Typed claim extraction (numeric, comparative, date, promo) |
|  • Stage 1 Verification: Deterministic exact-value & unit comparison (zero drift) |
|  • Stage 2 Verification: Google Gemini grounded verification & citation quotes    |
|  • Change Impact Engine: Dependency graph traversal (Fact -> Claims -> Assets)     |
+-----------------------------------------------------------------------------------+
                                         |
                                         | Vector Search & Relational Storage
                                         v
+-----------------------------------------------------------------------------------+
|                             DATA LAYER (PostgreSQL & pgvector)                    |
|  • PostgreSQL Tables: facts, claims, content_assets, review_tasks, audit_log      |
|  • pgvector Extension: 768-dim embeddings for evidence chunk retrieval            |
|  • Multi-Format Document Ingestion: PyMuPDF (PDF), python-docx (DOCX), plain text |
+-----------------------------------------------------------------------------------+
```

---

## 2. Core Data Model & Relational Schema

Proofline’s schema is implemented in PostgreSQL with the `pgvector` and `uuid-ossp` extensions:

```mermaid
erDiagram
    EVIDENCE_DOCUMENTS ||--o{ EVIDENCE_CHUNKS : "chunks"
    EVIDENCE_DOCUMENTS ||--o{ STRUCTURED_FACTS : "source of truth"
    STRUCTURED_FACTS ||--o{ CLAIMS : "governs"
    CONTENT_ASSETS ||--o{ CLAIMS : "contains"
    STRUCTURED_FACTS ||--o{ IMPACT_EVENTS : "triggers"
    IMPACT_EVENTS ||--o{ REVIEW_TASKS : "generates"
    CONTENT_ASSETS ||--o{ REVIEW_TASKS : "subject of"
    REVIEW_TASKS ||--o{ AUDIT_LOG : "records"

    EVIDENCE_DOCUMENTS {
        uuid id PK
        string title
        string doc_type
        string owner
        string version
        string approval_status
        date effective_date
        date expiry_date
        text raw_text
    }

    EVIDENCE_CHUNKS {
        uuid id PK
        uuid document_id FK
        int chunk_index
        text passage_text
        string section_title
        vector_768 embedding
        jsonb metadata
    }

    STRUCTURED_FACTS {
        uuid id PK
        string fact_key UK
        string name
        text current_value
        string unit
        uuid source_document_id FK
        text source_passage
        string version
        date effective_date
    }

    CONTENT_ASSETS {
        uuid id PK
        string title
        string asset_type
        string channel
        text raw_text
        string approval_status
        int version
        string last_approved_by
    }

    CLAIMS {
        uuid id PK
        uuid asset_id FK
        string claim_text
        string claim_type
        text exact_source_sentence
        uuid matched_fact_id FK
        string verification_status
        numeric confidence
        text reason
        text quoted_passage
        text suggested_correction
    }

    IMPACT_EVENTS {
        uuid id PK
        uuid fact_id FK
        string fact_key
        text old_value
        text new_value
        string triggered_by
        int total_assets_scanned
        int items_need_review
        int items_unaffected
    }

    REVIEW_TASKS {
        uuid id PK
        uuid asset_id FK
        uuid claim_id FK
        uuid impact_event_id FK
        string trigger_type
        string priority
        string assigned_role
        text original_text
        text suggested_text
        text explanation
        text cited_source
        string status
        string decided_by
        timestamp decided_at
    }

    AUDIT_LOG {
        uuid id PK
        string actor
        string actor_role
        string action
        string target_entity
        uuid target_id
        jsonb diff_payload
        text notes
        timestamp created_at
    }
```

---

## 3. The Change Impact Engine Workflow

The signature engine executes when any approved business fact is revised:

```
[1. User Edits Fact]
        |
        v  (e.g., Warranty 2 years -> 1 year in Warranty Policy v3)
[2. Delta & Graph Walk]
        |
        +---> Query all claims linked to Fact ID
        |
[3. Exact Check First (Stage 1)]
        |
        |---> Compare exact numbers & units (2.0 vs 1.0)
        |---> If identical or unrelated: Mark claim as "checked, not affected"
        |---> If conflicting: Mark claim as "outdated"
        |
[4. LLM Semantic & Grounded Check (Stage 2)]
        |
        |---> Retrieve evidence passage & generate context-preserving correction
        |
[5. Cascade Invalidation]
        |
        |---> Affected Assets: approval_status set to "approval_invalidated"
        |---> Unaffected Assets: marked safe, status untouched
        |
[6. Review Task Generation]
        |
        |---> Auto-create ReviewTask in Review Centre with red/green diff & citation
        |
[7. Audit Ledger Commitment]
        |
        +---> Record FACT_UPDATED, APPROVAL_INVALIDATED, and audit trail
```

---

## 4. Human-in-the-Loop Principle

At no point does the system auto-apply fixes to live content assets. The AI acts strictly as an advisory intelligence engine:
1. **AI Proposes:** Identifies exact conflicts, quotes the approved source passage, and suggests a non-destructive edit.
2. **Human Decides:** An authorized Reviewer or Admin must explicitly click **Approve**, **Reject**, or **Edit**.
3. **Decisions Are Audited:** The actor's identity, timestamp, role, and before/after text are committed to the immutable audit log.
