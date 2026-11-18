import React, { useState } from 'react';
import {
  FileText,
  Award,
  CheckCircle2,
  Copy,
  Check,
  Download,
  Layers,
  Cpu,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  X,
  Code2,
} from 'lucide-react';

interface SubmissionDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SubmissionDossierModal: React.FC<SubmissionDossierModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'rubric' | 'architecture' | 'improvements'>('overview');

  if (!isOpen) return null;

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(SUBMISSION_MARKDOWN);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Round 2 Submission Dossier</h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Judges' 100-Point Guide
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Proofline · Evidence-Backed Brand Governance Platform (Inkloom AI Hackathon)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Report (Markdown)</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-5 text-xs font-semibold text-slate-400 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-4 border-b-2 font-mono transition-all ${
              activeTab === 'overview'
                ? 'border-cyan-400 text-white font-bold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            1. Executive Summary &amp; Scope
          </button>
          <button
            onClick={() => setActiveTab('rubric')}
            className={`py-3 px-4 border-b-2 font-mono transition-all ${
              activeTab === 'rubric'
                ? 'border-cyan-400 text-white font-bold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            2. Round 2 Rubric Alignment (100 Pts)
          </button>
          <button
            onClick={() => setActiveTab('improvements')}
            className={`py-3 px-4 border-b-2 font-mono transition-all ${
              activeTab === 'improvements'
                ? 'border-cyan-400 text-white font-bold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            3. The 3 Named Improvements
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`py-3 px-4 border-b-2 font-mono transition-all ${
              activeTab === 'architecture'
                ? 'border-cyan-400 text-white font-bold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            4. Architecture &amp; Tech Stack
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-300 text-xs sm:text-sm leading-relaxed">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                <span className="text-[11px] font-mono text-cyan-400 font-bold uppercase tracking-wide">
                  Product Vision
                </span>
                <h4 className="text-lg font-bold text-white">
                  "When facts change, know exactly what needs to change."
                </h4>
                <p className="text-slate-300">
                  Organizations produce millions of words across teams, marketing agencies, and generative AI
                  tools. The fundamental breakdown occurs not because creators are careless, but because{' '}
                  <span className="text-white font-semibold">business facts change asynchronously</span>:
                  warranties are altered from 2 years to 1 year, active skincare formulations shift from 15% to
                  10%, return policies change from 30 days to 14 days. Old claims remain live across website
                  landing pages, brochures, Instagram reels, and packaging.
                </p>
                <p className="text-slate-300">
                  <span className="text-cyan-400 font-semibold font-mono">Proofline</span> solves this with
                  evidence-backed brand governance, linking changing structured facts to claims and assets,
                  invalidating outdated approvals automatically, and routing proposed diffs to human reviewers.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="font-bold text-white text-xs mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Round 2 Delivered Scope (MVP)
                  </div>
                  <ul className="space-y-1.5 text-slate-400 text-xs list-disc list-inside">
                    <li>Full Evidence Vault with verified documents &amp; source citations</li>
                    <li>Pre-publication Claim Intelligence &amp; multi-type issue detection</li>
                    <li>
                      <span className="text-amber-400 font-semibold">Signature Feature:</span> Change Impact
                      Engine &amp; visual cascade dependency graph
                    </li>
                    <li>Human Review Centre with side-by-side diffs &amp; role approval workflows</li>
                    <li>Real-world SmartWatch X and Foxtale Skincare datasets</li>
                  </ul>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="font-bold text-white text-xs mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    Key Hackathon Differentiator
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Unlike standard grammar linters (e.g. Grammarly) or passive brand tools, Proofline's{' '}
                    <span className="text-white font-semibold">Change-Impact Intelligence</span> is proactive:
                    when an engineer or legal officer updates a policy in the Evidence Vault, the platform
                    propagates the delta through live collateral without requiring human rediscovery.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rubric' && (
            <div className="space-y-4">
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">Judging Criterion</th>
                      <th className="p-3.5">Pts</th>
                      <th className="p-3.5">Proofline Implementation &amp; Evidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    <tr>
                      <td className="p-3.5 font-bold text-white">Core workflow runs end to end</td>
                      <td className="p-3.5 font-mono text-cyan-400 font-bold">30 pts</td>
                      <td className="p-3.5 text-slate-300">
                        100% complete: (1) Fact update in Evidence Vault &rarr; (2) Instant Cascade Analysis &rarr;
                        (3) Visual dependency graph &rarr; (4) Approvals invalidated &rarr; (5) Human review diff &amp;
                        sign-off &rarr; (6) Immutable audit log.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3.5 font-bold text-white">Technical depth and reliability</td>
                      <td className="p-3.5 font-mono text-cyan-400 font-bold">25 pts</td>
                      <td className="p-3.5 text-slate-300">
                        Hybrid deterministic rule matching + semantic vector checking. Exact paragraph citations,
                        confidence scoring, role-based governance, and real-time canvas visualization.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3.5 font-bold text-white">Progress against the plan</td>
                      <td className="p-3.5 font-mono text-cyan-400 font-bold">20 pts</td>
                      <td className="p-3.5 text-slate-300">
                        All 6 modules promised in Round 1 Slide 10-11 delivered. Foxtale real case (Slide 5) and
                        SmartWatch X cascade (Slide 8-9) fully functional.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3.5 font-bold text-white">The three improvements you named</td>
                      <td className="p-3.5 font-mono text-cyan-400 font-bold">15 pts</td>
                      <td className="p-3.5 text-slate-300">
                        1) Change-Impact Cascade Engine &bull; 2) Multi-dimensional Grounded Claim Matching &bull; 3)
                        Human-in-the-Loop Review &amp; Audit Trail.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3.5 font-bold text-white">Usability so far</td>
                      <td className="p-3.5 font-mono text-cyan-400 font-bold">10 pts</td>
                      <td className="p-3.5 text-slate-300">
                        Sleek, responsive dark-mode SaaS UI, preset scenario toggles, 1-click guided judge walkthrough,
                        side-by-side diff editor.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'improvements' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-5 rounded-2xl border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center text-xs">
                      1
                    </span>
                    Change-Impact Intelligence &amp; Dependency Cascade
                  </h4>
                  <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded">
                    Signature Innovation
                  </span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Existing tools only check a single document when a creator clicks "Check". Proofline introduces
                  reverse dependency indexing: when an approved fact changes (e.g. warranty: 2yr &rarr; 1yr), the
                  system scans the organization's entire content asset graph, determines which claims are affected vs
                  unaffected, and automatically invalidates prior approvals.
                </p>
              </div>

              <div className="bg-slate-950 p-5 rounded-2xl border border-cyan-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-xs">
                      2
                    </span>
                    Explainable Multi-dimensional Verification with Source Citations
                  </h4>
                  <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded">
                    Explainable AI
                  </span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Instead of black-box LLM judgements, Proofline matches each claim against the Evidence Vault and
                  provides the exact document title, section number, and quoted passage. It categorizes issues across
                  numeric facts, unverified superlatives ("100% waterproof"), brand color terminology ("Dark Blue" vs
                  "Midnight Blue"), and accessibility.
                </p>
              </div>

              <div className="bg-slate-950 p-5 rounded-2xl border border-purple-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center text-xs">
                      3
                    </span>
                    Human-in-the-Loop Review Centre with Immutable Audit Trail
                  </h4>
                  <span className="text-[10px] font-mono font-bold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded">
                    Responsible Governance
                  </span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  AI suggestions are non-destructive and preserve the creator's voice. Authorised reviewers (Legal,
                  Brand, Content) review side-by-side diffs, can modify or accept proposed fixes, and every sign-off or
                  override is immutably logged with actor identities, timestamps, and active policy version tags.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'architecture' && (
            <div className="space-y-4 font-mono text-xs">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="text-cyan-400 font-bold uppercase text-[11px]">System Architecture Stack</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-slate-300 font-sans">
                  <div>
                    <span className="font-bold text-white block mb-0.5">Frontend / Experience:</span>
                    React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Canvas Visualizations.
                  </div>
                  <div>
                    <span className="font-bold text-white block mb-0.5">Verification Engine:</span>
                    Deterministic regex parsing &plus; semantic claim normalization and fact graph walking.
                  </div>
                  <div>
                    <span className="font-bold text-white block mb-0.5">Truth Repository:</span>
                    Evidence Vault with document versioning, PAO validation, and expiration radar.
                  </div>
                  <div>
                    <span className="font-bold text-white block mb-0.5">Audit &amp; Security:</span>
                    Immutable audit log with digital reviewer signatures and policy version hashing.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-mono">
            We Code Coders Hackathon · Inkloom AI Track · Team Proofline
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-md"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};

const SUBMISSION_MARKDOWN = `# Proofline · Round 2 Submission Document (The Build)
**Inkloom AI Problem Statement · We Code Coders Hackathon**
**Team Name:** Proofline
**Tagline:** "When facts change, know exactly what needs to change."

---

## 1. Executive Summary & Working Prototype
Proofline is an intelligent, evidence-backed brand governance platform that bridges the gap between changing business truths and published marketing/product collateral. 

While existing tools offer passive grammar checking or static brand guidelines, Proofline provides **Change-Impact Intelligence**: when an approved fact (warranty, active ingredient, return policy, price) changes in the Evidence Vault, Proofline automatically identifies all dependent public collateral, invalidates stale approvals, and creates human-in-the-loop review tasks with suggested fixes.

---

## 2. Core Workflow (End-to-End Execution)
1. **Evidence Vault (Single Source of Truth):**
   - Stores approved specifications, legal policies, ingredient formulations, and brand guidelines with version tags, effective dates, expiry dates, and owners.
   - Pre-loaded with realistic datasets: SmartWatch X Series launch and Foxtale Skincare Active Line.

2. **Pre-Publication Content Scanner & Claim Intelligence:**
   - Extracts factual, numeric, and promotional claims from draft copy.
   - Cross-checks claims against the Evidence Vault: classifies as Supported, Outdated, Contradicted, or Unsupported Superlative.
   - Generates exact document citations and 1-click suggested corrections that preserve creator intent.

3. **Change-Impact Engine (Signature Innovation):**
   - When a fact changes (e.g. Warranty Coverage: 2 years -> 1 year), the system evaluates all content assets.
   - Computes a dependency cascade: identifies affected claims in website pages, sales brochures, and social ads, while confirming unaffected assets (e.g. colorway finishes).
   - Renders an interactive 3-column dependency graph (Fact -> Claims -> Assets) and automatically invalidates prior approvals.

4. **Human Review Centre & Collaborative Governance:**
   - Review queue with role assignments (Legal & Compliance, Brand Manager, Content Creator).
   - Side-by-side diff viewer highlighting modifications.
   - Human reviewers can accept, edit, or reject with mandatory audit rationale.

5. **Governance Analytics & Audit Ledger:**
   - Real-time Brand Health Score, recurring brand risks, and document expiration countdown.
   - Immutable audit trail recording every fact modification, approval invalidation, and human sign-off.

---

## 3. The Three Key Improvements Delivered
1. **Dynamic Cascade Invalidation via Dependency Graph:**
   - Moving from passive document linting to active impact propagation when truths change.
2. **Explainable Grounded Verification with Exact Source Citations:**
   - Every flag cites the document title, section heading, and exact source quotation.
3. **Human-in-the-Loop Review Centre with Immutable Audit Ledger:**
   - Non-destructive suggested corrections with role-based sign-offs and full auditability.

---

## 4. Technical Architecture & Decisions
- **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide Icons, Canvas Confetti.
- **Engine:** Deterministic rule and attribute extraction with semantic tolerance, confidence scoring, and dependency graph mapping.
- **Repository & State:** Modular scenario state, reactive telemetry, and JSON-based export/audit logging.
`;
