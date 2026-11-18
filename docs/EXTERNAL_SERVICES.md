# External Services, APIs, Libraries & Boilerplate Disclosures

This document discloses all third-party APIs, AI models, datasets, open-source libraries, templates, and coding tools utilized in the development of the Proofline Round 2 MVP, in accordance with the We Code Coders Hackathon rules.

---

## 1. External APIs & Cloud Services

| Service / API | Provider | Usage in Proofline | License / Terms |
|---|---|---|---|
| **Google Gemini API** | Google DeepMind | Claim extraction, structured semantic reasoning, grounded citation generation (`gemini-2.0-flash`) | Google AI Terms of Service |
| **Google Embeddings API** | Google DeepMind | Text embeddings (`text-embedding-004`, 768 dimensions) for evidence chunk indexing | Google AI Terms of Service |
| **Supabase** | Supabase Inc. | Cloud PostgreSQL hosting with `pgvector` extension and Supabase Auth | Apache 2.0 / Commercial Cloud |
| **Vercel** | Vercel Inc. | Frontend deployment and preview environment hosting | Commercial Terms |
| **Render / Railway** | Render / Railway | Backend container and service hosting | Commercial Terms |

*Note: Proofline includes a deterministic in-memory mock fallback engine. The application can run and pass all verification tests with 100% accuracy without an active Gemini API key or external Supabase connection.*

---

## 2. Open-Source Libraries & Frameworks

### Backend (Python)
- **FastAPI (v0.110.0+ / v0.164.0)** - High-performance web framework for APIs (MIT License).
- **Uvicorn (v0.28.0+ / v0.54.0)** - ASGI web server implementation (BSD-3-Clause).
- **Pydantic (v2.6.0+ / v2.14.3)** - Data validation and settings management using Python type hints (MIT License).
- **PyMuPDF (fitz) (v1.23.0+)** - High-speed PDF text extraction and document parsing (GNU AGPL v3 / Commercial).
- **python-docx (v1.1.0+)** - Microsoft Word DOCX reading and paragraph parsing (MIT License).
- **NumPy (v1.24.0+)** - Vector cosine similarity calculations and array operations (BSD-3-Clause).
- **google-genai (v0.1.0+)** - Official Google Gen AI Python SDK (Apache 2.0).
- **python-multipart (v0.0.9+)** - Streaming multipart form-data parser for file uploads (Apache 2.0).
- **python-dotenv (v1.0.0+)** - Reads key-value pairs from `.env` file (BSD-3-Clause).

### Frontend (TypeScript / React)
- **React 19 & React-DOM (v19.3.1)** - UI component rendering library (MIT License).
- **Vite (v8.3.6+)** - Next-generation frontend build tool and development server (MIT License).
- **Tailwind CSS (v4.3.5)** - Utility-first CSS framework (MIT License).
- **Lucide React (v1.73.0)** - Clean, modern iconography system (ISC License).
- **Canvas Confetti (v1.9.4)** - Visual feedback on review task completion and approval (ISC License).

---

## 3. Boilerplate & Templates Disclosed
- **Frontend Scaffolding:** Initialized using standard `create-vite` with the `react-ts` template. All components, state stores, custom visual graphs, and governance layouts were custom authored for Proofline.
- **Backend Architecture:** Structured following standard clean-architecture patterns for FastAPI applications.

---

## 4. Datasets Used
- **NovaWear SmartWatch X Launch Dataset:** Fictional hardware specification sheet, warranty policy v3.0/v3.1, pricing schedule, and cross-channel marketing collateral (product landing page, B2B sales brochure, Instagram advertisement, customer support FAQ).
- **Foxtale Skincare Real-World Guidance Dataset:** Real-world illustrative example derived from public brand customer response regarding 15% L-Ascorbic Acid, 6-month shelf life, and cool storage requirements (referenced in Round 1 Slide 5).
- **Brand Governance Survey Dataset:** Empirical research survey results collected from 20 brand managers, legal reviewers, and content creators during Round 1.
- **Evaluation Benchmark Dataset (`/eval/test_claims.json`):** 30 hand-labeled test claims across 5 verification categories (supported, contradicted, unsupported, outdated, needs_human_review).

---

## 5. AI Coding Assistant Disclosure
In accordance with Rule 7 ("AI, no-code and low-code tools are permitted... Significant tools and AI-generated components must be disclosed"):
- **Google Antigravity (Agentic AI Assistant):** Antigravity was used as an AI pair-programmer and code generation assistant during the hackathon development window to accelerate boilerplate implementation, create comprehensive test fixtures, draft documentation templates, and assist in refactoring type definitions.
