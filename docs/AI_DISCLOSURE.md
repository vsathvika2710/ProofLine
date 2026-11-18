# AI Disclosure & Responsible Governance

In accordance with the hackathon submission requirements, this document outlines where AI is used in the Proofline product, where AI is deliberately restricted, and how AI was used during software development.

---

## 1. Where AI is Used in the Product

### A. Factual Claim Extraction (Claim Intelligence)
- **Role:** Extracts individual factual statements from unstructured marketing copy (landing pages, brochures, social posts).
- **Model:** Google Gemini (`gemini-2.0-flash`).
- **Output:** Categorized claims with type (`numeric`, `comparative`, `date`, `promotional`, `other`), exact source sentence, and character offsets.
- **Fail-safe:** Falls back to deterministic sentence boundary regex and token analysis if the AI API is offline or unconfigured.

### B. Semantic Evidence Verification & Citation (Stage 2)
- **Role:** Evaluates whether a claim is supported, contradicted, outdated, or unsupported by approved evidence chunks retrieved via vector similarity.
- **Model:** Google Gemini (`gemini-2.0-flash`) + `text-embedding-004`.
- **Constraint:** Must return structured JSON quoting the verbatim evidence passage and providing a numerical confidence score (0.00 to 1.00).

### C. Context-Preserving Correction Suggestions
- **Role:** Proposes an updated sentence that fixes outdated or contradicted claims while preserving the creator’s original promotional tone and voice.
- **Constraint:** Advisory only. Corrections are presented as red/green diffs for human evaluation.

---

## 2. Where AI is NOT Used (Deliberate Architectural Boundaries)

To protect brand reputation and satisfy compliance requirements, AI is strictly prohibited from executing the following actions:

1. **Exact-Value Checks (Stage 1):** Numbers, measurement units, currency values, and dates are checked by deterministic code FIRST. An LLM is never allowed to override a mathematical mismatch (e.g., claiming 2 years equals 1 year).
2. **Approval Restoration:** An AI model cannot mark an asset as approved or publish content. Only human users with the `reviewer` or `admin` role can sign off.
3. **Graph Traversal & Invalidation:** The Change Impact Engine uses deterministic relational graph lookups to trace dependent claims from changed facts. No probabilistic guesses determine asset invalidation.
4. **Data Retention for Training:** Confidential brand materials and draft campaigns are transmitted via external APIs under enterprise terms with zero data retention for model training.

---

## 3. In-App User Confidentiality Notice

Proofline displays a mandatory disclosure banner inside the scanning interface:

> **CONFIDENTIALITY & AI DISCLOSURE:**  
> Pre-publication claims and evidence text are evaluated using Google Gemini models with grounded citations. No proprietary brand data is retained for external model training. AI suggestions are strictly advisory and require human reviewer sign-off.

---

## 4. AI Usage During Software Development

Proofline was engineered with the assistance of **Antigravity** (Google DeepMind agentic coding assistant):
- **Development Window:** Built during the official Round 2 hackathon development window.
- **Tasks Assisted by AI:** Generating FastAPI endpoint skeletons, authoring TypeScript interface definitions, generating 30-claim evaluation benchmark sets, formatting markdown documentation, and running automated regression tests.
- **Human Review & Authorship:** All architectural decisions, design schemas, exact verification algorithms, and UX workflows were designed, reviewed, and validated by the team.
