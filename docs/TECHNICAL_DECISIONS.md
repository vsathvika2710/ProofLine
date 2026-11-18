# Technical Decisions & Rationale

This document details the architectural choices, tradeoffs, and design rationale behind the Proofline Round 2 MVP.

---

## 1. FastAPI (Python) for the Backend

### Choice:
Python 3.11+ with **FastAPI** and **Pydantic v2**.

### Rationale:
- **Native Document & AI Ecosystem:** Document parsing libraries (PyMuPDF for PDF, python-docx for DOCX), array mathematics (numpy), and Google GenAI SDK are first-class in Python.
- **Strict Data Validation:** Pydantic v2 provides high-performance schema serialization and enforces structured JSON contract validation with automatic retries on LLM parsing failures.
- **Asynchronous Performance:** FastAPI delivers high throughput for concurrent I/O operations (vector retrieval, external AI API calls).
- **Auto-Generated Documentation:** Native OpenAPI (Swagger UI) at `/docs` simplifies integration testing for hackathon judges and frontend teams.

---

## 2. PostgreSQL with pgvector (Supabase Compatible)

### Choice:
Unified relational database with the **`pgvector`** extension.

### Rationale:
- **Single Store for Relations & Vectors:** Avoids the operational overhead and synchronization lag of running separate vector databases (e.g. Pinecone, Qdrant) alongside relational stores.
- **Referential Integrity:** Structured facts, claims, assets, and evidence chunks share direct foreign key relationships (`ON DELETE CASCADE`), ensuring cascade deletions and updates remain ACID-compliant.
- **pgvector Cosine Distance:** Enables fast vector similarity searches (`<->` or `<=>`) on 768-dimensional text embeddings (`text-embedding-004`) directly alongside standard SQL filters (e.g. document owner, approval status, effective date).
- **Graceful Local Fallback:** The backend includes an in-memory/dictionary storage engine so judges can evaluate the entire application locally with zero configuration without needing an active cloud database connection.

---

## 3. Two-Stage Verification: Exact Checks First, LLM Second

### Choice:
Deterministic regex and unit/number normalization as Stage 1; Google Gemini grounded verification as Stage 2.

### Rationale:
- **Auditability & Regulatory Defense:** In regulated industries (consumer hardware, health, fintech), relying solely on non-deterministic LLM judgements invites hallucinations and silent drift on critical numeric thresholds.
- **Speed & Cost Efficiency:** Exact numeric matching (e.g. detecting that "2 years" mismatches an approved "1 year" policy) executes in sub-millisecond time without incurring API token costs or network latency.
- **Zero Ambiguity on Unrelated Claims:** The exact check cleanly classifies independent claims (e.g., "Available in Midnight Blue") as "checked, not affected," eliminating alert fatigue.
- **Explainability:** When an LLM does formulate a suggestion, it is strictly grounded by quoting the exact source passage retrieved in Stage 1.

---

## 4. Human-in-the-Loop Governance (Never Auto-Apply)

### Choice:
Strict advisory role for AI; manual sign-off required for all content updates and approval restorations.

### Rationale:
- **Round 1 Survey Feedback:** 100% of surveyed brand and compliance managers (N=20) demanded human oversight before any marketing copy is altered.
- **Brand Voice Preservation:** While an LLM can suggest a factually correct replacement, human copywriters must ensure brand cadence, rhythm, and tone are maintained.
- **Accountability:** Legally, automated systems cannot bear regulatory liability. Every approval change records the specific human reviewer's credentials and timestamp.

---

## 5. FastAPI BackgroundTasks vs. Celery/Redis

### Choice:
FastAPI `BackgroundTasks` for Round 2 MVP; Celery + Redis scheduled for Round 3.

### Rationale:
- **MVP Simplicity & Zero Infrastructure Friction:** Running Celery requires Redis/RabbitMQ message brokers, worker daemon processes, and celery beat schedulers. For the Round 2 evaluation, FastAPI's built-in `BackgroundTasks` processes document parsing and embedding indexing asynchronously without requiring extra Docker containers.
- **Developer & Judge Experience:** Enables running the complete backend with a single command (`uvicorn main:app`).
- **Round 3 Roadmap:** In Round 3, when bulk enterprise document ingestion (100+ documents concurrently) and scheduled periodic web crawls are introduced, the task dispatcher will transition to Celery with Redis persistence.
