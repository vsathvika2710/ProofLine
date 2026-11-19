# Proofline · Evidence-Backed Brand Governance Platform

> **"When facts change, know exactly what needs to change."**  
> *Built for the We Code Coders Hackathon · Problem Statement by Inkloom AI*  
> *Round 2 Submission: The Build (MVP Prototype)*

> 🌐 **LIVE PUBLIC PROTOTYPE (NO DOWNLOAD REQUIRED):**  
> 👉 **[https://vsathvika2710.github.io/ProofLine/](https://vsathvika2710.github.io/ProofLine/)**  
> *Fully interactive in-browser prototype — test the signature Change-Impact Engine, 3-column dependency graph, and Review Centre immediately with zero installation.*

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Backend](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.11+-009688.svg)]()
[![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite%20%7C%20TailwindCSS-0ea5e9.svg)]()
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%7C%20pgvector-336791.svg)]()
[![AI](https://img.shields.io/badge/AI-Google%20Gemini%202.0%20%7C%20Embeddings-4285F4.svg)]()
[![Benchmark](https://img.shields.io/badge/Benchmark-100%25%20Accuracy%20(30%2F30)-success.svg)]()

---

## 📌 1. What is Proofline?

Growing organisations publish content across dozens of employees, external agencies, and AI tools. While traditional linters focus on passive grammar or tone, the primary driver of legal liability and customer mistrust is **untracked business fact drift**:
- A warranty policy updates from **2 years to 1 year**.
- A product specification shifts water resistance from **50m to 30m**.
- An unconditional return window shortens from **30 days to 14 days**.

Old, contradictory claims remain live across website product pages, sales brochures, social ads, and customer support FAQs. Marketing and compliance teams struggle to find every affected piece of content.

**Proofline solves this with an evidence-backed brand governance platform and the Change Impact Engine:**
1. **Evidence Vault:** Stores approved source documents (PDF, DOCX, TXT) and structured business facts.
2. **Claim Intelligence & Evidence Matching:** Extracts claims from content and evaluates them using a **two-stage verification process**: exact checks first (numbers, units, dates), grounded LLM judgement second.
3. **Change Impact Engine (Signature Feature):** When an approved fact is modified, Proofline walks the fact-claim-asset dependency graph, determines which content assets are affected, marks unrelated claims as *checked and not affected*, invalidates prior approvals, and creates human review tasks.
4. **Human Review Centre:** AI suggests corrections with verbatim citations; human reviewers make the final decision (Approve, Reject, or Edit). Never auto-apply fixes.

---

## 🚀 2. Live Demo Links & Deployment

- **Live Demo (GitHub Pages):** [https://vsathvika2710.github.io/ProofLine/](https://vsathvika2710.github.io/ProofLine/)
- **1-Click Vercel Deployment:** [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvsathvika2710%2FProofLine)  
  *(Deploys the complete frontend in 30 seconds to your Vercel account)*
- **1-Click Render Deployment (Backend & Frontend):** [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/vsathvika2710/ProofLine)  
  *(Automatically provisions FastAPI Python API & static frontend using `render.yaml`)*
- **Source Code Repository:** [https://github.com/vsathvika2710/ProofLine](https://github.com/vsathvika2710/ProofLine) *(Contains complete git commit history across all 7 build phases)*

---

## ⚡ 3. One-Command Quick Start

Proofline runs out of the box with zero required external dependencies thanks to an automatic in-memory fallback store and deterministic mock verification mode.

### Option A: One-Command Docker Compose (Full Stack)
```bash
# Starts PostgreSQL (pgvector), FastAPI backend, and React frontend
docker-compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API & Swagger Docs: `http://localhost:8000/docs`

### Option B: Local PowerShell / Bash Scripts
**Windows (PowerShell):**
```powershell
.\start.ps1
```

**macOS / Linux (Bash):**
```bash
chmod +x start.sh
./start.sh
```

### Option C: Manual Step-by-Step Setup
```bash
# 1. Backend (Terminal 1)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 2. Frontend (Terminal 2)
npm install
npm run dev
```

---

## 🧪 4. 30-Claim Evaluation Benchmark

Proofline includes a formal 30-claim evaluation suite in `/eval/test_claims.json` spanning all 5 status classifications (`supported`, `contradicted`, `unsupported`, `outdated`, `needs_human_review`).

Run the benchmark script:
```bash
python eval/run_eval.py
```

### Verified Benchmark Output:
```text
======================================================================
PROOFLINE EVALUATION SUITE · 30-CLAIM BENCHMARK (Round 2)
======================================================================
Total Test Claims Evaluated: 30
Overall Exact Categorization Accuracy: 100.0% (30/30)
Problem Detection Precision:            100.0%
Problem Detection Recall:               100.0%
False-Positive Rate (FPR):              0.0%

Category Breakdown:
  • Supported           : 6/6 (100.0%)
  • Contradicted        : 6/6 (100.0%)
  • Unsupported         : 6/6 (100.0%)
  • Outdated            : 6/6 (100.0%)
  • Needs human review  : 6/6 (100.0%)
======================================================================
```

Run the end-to-end workflow verification script:
```bash
python backend/test_e2e_flow.py
```

---

## 🎭 5. Demo Script & Test Credentials

### Test Role Credentials
Proofline enforces role-based access control (RBAC). Use the in-app **Role Switcher** in the top navigation bar to test each persona:

| Role | Test Identity | Email | Permissions |
|---|---|---|---|
| **Legal Reviewer** | Sarah Chen (Compliance Lead) | `compliance@inkloom.ai` | Can review, approve, reject, and edit tasks. Can invalidate approvals. |
| **Brand Administrator** | Marcus Vance (VP Brand Ops) | `admin@inkloom.ai` | Full permissions: edit facts, trigger cascade, approve reviews, view audit ledger. |
| **Content Creator** | Liam Kelly (Senior Copywriter) | `creator@inkloom.ai` | Can upload content, scan text, and request review. Cannot approve tasks. |

### Step-by-Step Demo Flow
1. **Load Demo Workspace:** Click **"Reset Demo Data"** or click **"Load Demo Workspace"** to populate the fictional brand *"NovaWear"* and product *"SmartWatch X"*.
2. **Review Evidence Vault:** Open the **Evidence Vault** tab to view approved source documents (*Warranty Policy v3.0*, *Product Spec Sheet*, *Pricing Sheet*).
3. **Inspect Content Assets:** Open the **Content Reviewer** tab to see 4 pre-loaded assets:
   - *Official Product Page* ("2-year warranty", "water resistance 50m")
   - *Sales Brochure* ("Two-year warranty", "battery 7 days")
   - *Instagram Post* ("Two years of coverage")
   - *Colours Guide* ("Available in Midnight Blue and Silver")
4. **Trigger Signature Change-Impact Engine:**
   - Go to the **Change Impact** tab.
   - Locate the fact **"Hardware Warranty Coverage"** (Current value: `2 years`).
   - Change the value to **`1 year`** and click **"Evaluate Impact"**.
5. **Inspect the Blast Radius View:**
   - Summary Metric: **1 fact changed, 3 items need review, 1 checked, not affected**.
   - Notice that the *Colours Guide* asset is marked as `checked, not affected` because color options are mathematically and semantically independent of warranty terms!
   - Notice that the 3 dependent assets have their prior approval automatically invalidated.
6. **Execute Human-in-the-Loop Review:**
   - Switch role to **Legal Reviewer** (`compliance@inkloom.ai`).
   - Open the **Review Centre**.
   - Inspect the pending task for the Product Page: view the side-by-side red/green diff comparing `"2-year warranty"` with suggested correction `"1-year warranty"` cited to *Warranty Policy v3.1*.
   - Click **"Approve Correction"**.
   - Watch the asset version increment from `v1` to `v2` and its approval status restore to `Approved`.
7. **Inspect Audit Trail:**
   - Open the **Audit Ledger** in the Dossier/Analytics tab to see every timestamped event recorded chronologically.

---

## 📂 6. Documentation Directory Index

In compliance with Round 2 submission requirements, detailed reports are organized in `/docs`:

- [ARCHITECTURE.md](docs/ARCHITECTURE.md): Layered architecture diagram, pgvector relational schema, and Change Impact data model.
- [TECHNICAL_DECISIONS.md](docs/TECHNICAL_DECISIONS.md): FastAPI, pgvector, exact-checks-first, human-in-the-loop, and BackgroundTasks vs Celery.
- [EXTERNAL_SERVICES.md](docs/EXTERNAL_SERVICES.md): Full disclosure of all APIs, models (Gemini 2.0), datasets, libraries, and open-source licenses.
- [AI_DISCLOSURE.md](docs/AI_DISCLOSURE.md): Exact details of where AI is used, where AI is strictly prohibited, and AI tool disclosures.
- [USER_TESTING.md](docs/USER_TESTING.md): 5-task testing protocol, participant feedback table, completion metrics, and qualitative quotes.
- [CONTRIBUTIONS.md](docs/CONTRIBUTIONS.md): Team member roster, roles, deliverables, and commit ownership.
- [PROGRESS_VS_PLAN.md](docs/PROGRESS_VS_PLAN.md): Feature matrix comparing the Round 1 proposal against delivered Round 2 code.
- [THREE_IMPROVEMENTS.md](docs/THREE_IMPROVEMENTS.md): The three named improvements for Round 3, current baseline metrics, and planned target gains.

---

## 🎨 7. Design System & Status Badges

Built with Tailwind CSS using the palette from the Round 1 pitch deck:
- **Navy Background:** `#0B1B33` (Slate 950 / Slate 900)
- **Teal / Cyan Accent:** `#2BC4C4` (Primary actions, active states)
- **Amber Accent:** `#F5A623` (Impact alerts, review required)

### Status Badges:
- 🟢 **Supported:** Claim matches approved evidence source passage.
- 🟡 **Needs Review / Outdated:** Fact drift detected; requires human sign-off.
- 🔴 **Contradicted:** Claim directly conflicts with approved specifications.
- ⚪ **Unsupported:** Promotional statement has no grounding in the Evidence Vault.
- 🔵 **Not Affected:** Inspected by Change Impact Engine and verified independent of fact delta.
