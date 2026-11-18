# Team Member Contributions Statement

In accordance with Round 2 submission rules ("Each team member must accurately state their role and personal contribution wherever individual contribution reporting is required"), this statement outlines individual responsibilities and completed deliverables.

---

## Team Roster & Contribution Breakdown

| Team Member | Role | Concrete Deliverables & Contributions | Key Commits / PR Areas |
|---|---|---|---|
| **Lead System Architect & Backend Engineer** | Full-Stack Architect & Python Lead | • Architected FastAPI backend endpoints (`/api/evidence`, `/api/claims`, `/api/impact`, `/api/reviews`, `/api/audit`).<br>• Designed PostgreSQL relational schema with `pgvector` extensions for hybrid vector-relational search.<br>• Implemented document extraction for PDF (PyMuPDF) and DOCX (python-docx).<br>• Configured Docker containerization and deployment pipelines for Render and Vercel. | `backend/main.py`<br>`backend/schema.sql`<br>`backend/models.py`<br>`backend/database.py`<br>`docker-compose.yml` |
| **AI & Verification Intelligence Specialist** | AI / ML Engineer | • Engineered two-stage claim verification engine: Stage 1 exact-value/unit check + Stage 2 Gemini grounded verification.<br>• Authored the signature Change Impact Engine (`change_impact_engine.py`) with reverse dependency graph traversal.<br>• Curated the 30-claim evaluation benchmark dataset (`test_claims.json`) and eval runner script (`run_eval.py`).<br>• Implemented deterministic grounded mock fallback for zero-dependency execution. | `backend/claim_intelligence.py`<br>`backend/change_impact_engine.py`<br>`backend/embedding_engine.py`<br>`eval/run_eval.py`<br>`eval/test_claims.json` |
| **Frontend Engineer & Design Lead** | UI/UX & Frontend Developer | • Developed responsive Next.js/React frontend with Tailwind CSS (dark navy `#0B1B33`, teal `#2BC4C4`, amber `#F5A623`).<br>• Created the signature interactive 3-column Change Impact visualizer (`ImpactDashboard.tsx` & `ImpactGraph.tsx`).<br>• Built the Human Review Centre with side-by-side red/green diff viewer and role switcher.<br>• Implemented the Brand Health Score telemetry dashboard and guided judge walkthrough modal. | `src/App.tsx`<br>`src/components/ChangeImpact/*`<br>`src/components/ReviewCenter/*`<br>`src/components/EvidenceVault/*`<br>`src/components/Navbar.tsx` |

---

## Individual Sign-Off & Verification
All team members confirm that the prototype was engineered collaboratively during the designated hackathon build window, adheres to all open-source licensing rules, and transparently discloses all AI tools and external services used.
