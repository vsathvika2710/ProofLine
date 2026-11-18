# The Three Named Improvements for Round 3

In accordance with the hackathon judging criteria ("The three improvements you named: state current baseline for each, so Round 3 can show measurable gain"), this document outlines the three focal areas targeted for the final round.

---

## Improvement 1: Scaled & High-Fidelity Evidence Matching

### Current Baseline in Round 2:
- **Baseline Test Set:** 30 labeled claims evaluated via `/eval/run_eval.py`.
- **Retrieval Mechanism:** Exact numeric and string-token normalization combined with top-3 vector chunk retrieval using fixed-size 300-word passages.
- **Accuracy / Recall:** 100% precision and recall on the 30-claim benchmark with clean single-clause statements.
- **Identified Limitation:** Struggles on complex multi-clause compound sentences where a single sentence contains multiple interdependent claims (e.g. *"Our watch is rated 50m water resistant while running Beta OS v1.2 with 7 days battery, but extended GPS drops it to 14 hours"*).

### Planned Round 3 Target & Measurable Gain:
- **Expanded Benchmark:** Expand test set from 30 to **100 labeled claims** (20 each of supported, contradicted, unsupported, outdated, and ambiguous/complex).
- **Hierarchical Re-Ranking:** Implement two-tiered hybrid dense-sparse retrieval (BM25 + pgvector reciprocal rank fusion) and cross-encoder re-ranking.
- **Target Metric:** Maintain >92% categorization accuracy and <3% false-positive rate across the complex 100-claim dataset.

---

## Improvement 2: Automated Background Impact Analysis & Ingestion Triggers

### Current Baseline in Round 2:
- **Triggering Mechanism:** Impact analysis is invoked on-demand via direct user fact edit (`POST /api/impact/change-fact`) or content upload.
- **Worker Execution:** Handled via FastAPI's synchronous process loop and `BackgroundTasks` in-process thread pool.
- **Identified Limitation:** If a compliance manager uploads a revised 50-page PDF policy document with 20 changed facts, each fact must be updated manually or scanned individually.

### Planned Round 3 Target & Measurable Gain:
- **Automated Diff Parsing on Document Upload:** When a new version of an existing policy document is uploaded (e.g. *Warranty Policy v4.0* replacing *v3.1*), an automated document diff engine will identify all altered structured facts automatically.
- **Celery + Redis Worker Architecture:** Migrate background jobs from in-process threads to a distributed Celery worker pool capable of processing 500+ assets in parallel.
- **Target Metric:** End-to-end automated impact detection from document drop to task generation in under 3.5 seconds across 1,000 dependent assets.

---

## Improvement 3: Full Enterprise Version History, Audit Lineage & Role Approvals

### Current Baseline in Round 2:
- **Version Tracking:** Integer asset version counter (`v1 -> v2`) and basic single-level audit trail entries.
- **Review Workflow:** Single-reviewer sign-off (Approve / Reject / Edit) with role simulation.
- **Citations:** Textual quotation of source document and passage text.

### Planned Round 3 Target & Measurable Gain:
- **Cryptographic Audit Ledger & Visual Timeline:** Implement tamper-evident SHA-256 hash chaining across audit log events with visual revision scrubbing (comparing any two historical versions side-by-side).
- **Multi-Tier Role-Based Sign-Off Gates:** Configurable review policies requiring dual sign-offs (e.g. Legal Reviewer + Brand Director) for high-severity or regulatory-risk content assets.
- **Deep Document Deep-Linking:** Direct PDF page and line-number deep links that highlight the physical approved clause within the embedded PDF viewer.
- **Target Metric:** 100% reproducible audit lineage with dual-approval workflow support and sub-second visual diff rendering for multi-page assets.
