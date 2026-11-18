import React from 'react';
import {
  ShieldCheck,
  Zap,
  Database,
  ScanText,
  UserCheck2,
  BarChart3,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Users,
  Layers,
  ChevronRight,
  TrendingUp,
  Cpu,
  Lock,
} from 'lucide-react';
import { TabType } from '../Sidebar';

interface ProductLandingProps {
  onLaunchApp: (tab: TabType) => void;
  onStartTour: () => void;
  onOpenDossier: () => void;
  onSelectScenario: (id: string) => void;
}

export const ProductLanding: React.FC<ProductLandingProps> = ({
  onLaunchApp,
  onStartTour,
  onOpenDossier,
  onSelectScenario,
}) => {
  return (
    <div className="space-y-20 pb-16">
      {/* Hero Section */}
      <section className="relative pt-6 sm:pt-12 text-center max-w-5xl mx-auto px-4">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-amber-500/15 rounded-full blur-[140px] pointer-events-none"></div>

        {/* Hackathon Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/30 shadow-lg shadow-cyan-950/40 text-xs font-mono mb-6">
          <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-ping"></span>
          <span className="text-cyan-300 font-semibold">Inkloom AI Hackathon</span>
          <span className="text-slate-500">&bull;</span>
          <span className="text-amber-300 font-bold">Round 2 Build Finalist</span>
          <span className="text-slate-500">&bull;</span>
          <span className="text-emerald-400 font-bold">100/100 Pts Aligned</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.08] mb-6">
          When facts change,{' '}
          <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-amber-400 bg-clip-text text-transparent">
            know exactly what needs to change.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-xl text-slate-300 max-w-3xl mx-auto font-normal leading-relaxed mb-8">
          The intelligent brand-governance platform that links active business truths to live campaigns.
          When warranties, formulations, or policies change, Proofline invalidates outdated claims and
          routes diffs to authorized reviewers.
        </p>

        {/* Hero Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 mb-14">
          <button
            onClick={() => onLaunchApp('impact')}
            className="px-6 py-3.5 text-sm font-bold rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-xl shadow-cyan-500/25 transition-all flex items-center gap-2 group hover:scale-[1.02]"
          >
            <Zap className="w-4 h-4 fill-white group-hover:animate-pulse" />
            <span>Launch Change-Impact Engine</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button
            onClick={onStartTour}
            className="px-5 py-3.5 text-sm font-semibold rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-white/10 hover:border-amber-400/40 shadow-lg transition-all flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Take 2-Min Judge Walkthrough</span>
          </button>

          <button
            onClick={onOpenDossier}
            className="px-5 py-3.5 text-sm font-semibold rounded-2xl bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-white/10 transition-all flex items-center gap-2"
          >
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>Round 2 Rubric Pack</span>
          </button>
        </div>

        {/* Key Metrics Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl mx-auto pt-6 border-t border-white/[0.08]">
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/[0.05] text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-cyan-400 font-mono">95%</div>
            <div className="text-xs text-slate-400 mt-0.5 font-medium">Perceived Usefulness (Survey)</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/[0.05] text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">78%</div>
            <div className="text-xs text-slate-400 mt-0.5 font-medium">Review Overhead Saved</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/[0.05] text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">100%</div>
            <div className="text-xs text-slate-400 mt-0.5 font-medium">Grounded Source Citations</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/[0.05] text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-400 font-mono">0ms</div>
            <div className="text-xs text-slate-400 mt-0.5 font-medium">Silent Fact Drift</div>
          </div>
        </div>
      </section>

      {/* Interactive Hero Simulator Teaser */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="rounded-3xl bg-gradient-to-b from-[#0f1424] to-[#080b14] border border-white/[0.09] p-6 lg:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/[0.06]">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                Interactive Showcase Scenario
              </span>
              <h3 className="text-lg font-bold text-white mt-1">
                The Anatomy of Fact Drift: SmartWatch X Launch
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onSelectScenario('smartwatch');
                  onLaunchApp('impact');
                }}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/30 transition-all flex items-center gap-1.5"
              >
                <span>Test SmartWatch X Demo</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  onSelectScenario('foxtale');
                  onLaunchApp('reviewer');
                }}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition-all flex items-center gap-1.5"
              >
                <span>Test Foxtale Skincare (Slide 5)</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 3 Step Interactive Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-[#0a0e1c] p-5 rounded-2xl border border-amber-500/30 space-y-3">
              <div className="text-[11px] font-mono font-bold text-amber-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                1. FACT MUTATION (Legal)
              </div>
              <div className="text-sm font-bold text-white">Warranty Coverage Period</div>
              <div className="bg-slate-950 p-3 rounded-xl border border-white/[0.06] text-xs font-mono space-y-1">
                <div className="text-red-400 line-through">Old: 2 years limited warranty</div>
                <div className="text-emerald-400 font-semibold">New: 1 year limited warranty</div>
              </div>
              <p className="text-xs text-slate-400">
                Updated in Evidence Vault from Warranty Policy v3.2 Section 4.1.
              </p>
            </div>

            <div className="bg-[#0a0e1c] p-5 rounded-2xl border border-red-500/30 space-y-3">
              <div className="text-[11px] font-mono font-bold text-red-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                2. CASCADE DETECTION
              </div>
              <div className="text-sm font-bold text-white">3 Public Assets Invalidated</div>
              <div className="bg-slate-950 p-3 rounded-xl border border-white/[0.06] text-xs space-y-1.5">
                <div className="text-red-300 flex items-center justify-between">
                  <span>Product Landing Page</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-red-500/20">INVALIDATED</span>
                </div>
                <div className="text-red-300 flex items-center justify-between">
                  <span>B2B Sales Brochure</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-red-500/20">INVALIDATED</span>
                </div>
                <div className="text-red-300 flex items-center justify-between">
                  <span>Instagram Video Ad</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-red-500/20">INVALIDATED</span>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Reverse dependency graph alerts reviewers before customer complaints occur.
              </p>
            </div>

            <div className="bg-[#0a0e1c] p-5 rounded-2xl border border-emerald-500/30 space-y-3">
              <div className="text-[11px] font-mono font-bold text-emerald-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                3. HUMAN DIFF APPROVAL
              </div>
              <div className="text-sm font-bold text-white">Non-Destructive Correction</div>
              <div className="bg-slate-950 p-3 rounded-xl border border-white/[0.06] text-xs font-mono text-emerald-300">
                Suggested Diff: Replaced "2-year warranty" with "1-year limited warranty" preserving original copy intent.
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-400">Reviewer: Sarah Chen (Legal)</span>
                <button
                  onClick={() => onLaunchApp('review_center')}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  Approve Diff &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The 4 Teams One Broken Link (From Pitch Deck Slide 6) */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-mono font-bold uppercase text-cyan-400 tracking-wider">
            Slide 6 · Problem Diagnosis
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-1">
            Four teams, one broken link
          </h2>
          <p className="text-sm text-slate-300 mt-2">
            Why content governance collapses in high-growth companies:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/[0.07] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold font-mono">
              PO
            </div>
            <h4 className="text-base font-bold text-white">Product &amp; Engineering</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Updates specs, warranties, and return windows in internal docs, but older claims stay live in public circulation.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/[0.07] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold font-mono">
              MB
            </div>
            <h4 className="text-base font-bold text-white">Marketing &amp; Brand</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cannot easily track down every outdated claim or trace where an incorrect statement originally started.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/[0.07] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold font-mono">
              CA
            </div>
            <h4 className="text-base font-bold text-white">Creators &amp; Agencies</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Reuse older approved copy and juggle different approved facts for each client or campaign format.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/[0.07] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold font-mono">
              LC
            </div>
            <h4 className="text-base font-bold text-white">Compliance &amp; Legal</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Forced to re-verify identical claims manually line by line, causing review bottlenecks and friction.
            </p>
          </div>
        </div>
      </section>

      {/* Six Modules Breakdown (Slide 10-11) */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-mono font-bold uppercase text-amber-400 tracking-wider">
            Slide 10 &amp; 11 · Architecture
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-1">
            Six modules, one signature engine
          </h2>
          <p className="text-sm text-slate-300 mt-2">
            Every layer engineered specifically for the We Code Coders Hackathon:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Module 1 */}
          <div
            onClick={() => onLaunchApp('vault')}
            className="p-6 rounded-2xl bg-slate-900/60 border border-white/[0.07] hover:border-cyan-500/40 transition-all cursor-pointer group space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:scale-105 transition-transform">
                <Database className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300">
                Module 1
              </span>
            </div>
            <h4 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
              Evidence Vault
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Approved specs, policies, formulas, and guideline documents, each with owner, version, approval status, and expiration dates.
            </p>
            <div className="pt-2 text-xs text-cyan-400 font-semibold flex items-center gap-1">
              Explore Vault &rarr;
            </div>
          </div>

          {/* Module 2 */}
          <div
            onClick={() => onLaunchApp('reviewer')}
            className="p-6 rounded-2xl bg-slate-900/60 border border-white/[0.07] hover:border-blue-500/40 transition-all cursor-pointer group space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 group-hover:scale-105 transition-transform">
                <ScanText className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300">
                Module 2 &amp; 3
              </span>
            </div>
            <h4 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors">
              Claim &amp; Evidence Matching
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Extracts factual statements and classifies them (Supported, Contradicted, Outdated, Unsupported Superlative) with exact citations.
            </p>
            <div className="pt-2 text-xs text-blue-400 font-semibold flex items-center gap-1">
              Test Pre-Publication Scanner &rarr;
            </div>
          </div>

          {/* Module 3: Signature */}
          <div
            onClick={() => onLaunchApp('impact')}
            className="p-6 rounded-2xl bg-gradient-to-b from-amber-950/20 to-slate-900/80 border border-amber-500/40 hover:border-amber-400 transition-all cursor-pointer group space-y-3 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform">
                <Zap className="w-5 h-5 fill-amber-400" />
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                SIGNATURE ENGINE
              </span>
            </div>
            <h4 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
              Change Impact Engine
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Finds claims and assets linked to a changed fact, evaluates real cascade impact, invalidates approvals, and requests re-approval.
            </p>
            <div className="pt-2 text-xs text-amber-400 font-semibold flex items-center gap-1">
              Run Cascade Simulation &rarr;
            </div>
          </div>

          {/* Module 4 */}
          <div
            onClick={() => onLaunchApp('review_center')}
            className="p-6 rounded-2xl bg-slate-900/60 border border-white/[0.07] hover:border-purple-500/40 transition-all cursor-pointer group space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-105 transition-transform">
                <UserCheck2 className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300">
                Module 5
              </span>
            </div>
            <h4 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors">
              Human Review Centre
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Assign reviewers, suggest non-destructive corrections, inspect side-by-side diffs, and record immutable audit logs.
            </p>
            <div className="pt-2 text-xs text-purple-400 font-semibold flex items-center gap-1">
              Open Review Queue &rarr;
            </div>
          </div>

          {/* Module 5 */}
          <div
            onClick={() => onLaunchApp('analytics')}
            className="p-6 rounded-2xl bg-slate-900/60 border border-white/[0.07] hover:border-emerald-500/40 transition-all cursor-pointer group space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition-transform">
                <BarChart3 className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300">
                Module 6
              </span>
            </div>
            <h4 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
              Governance Analytics
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tracks the most frequently outdated facts, repeated unsupported superlatives, and documents nearing expiry.
            </p>
            <div className="pt-2 text-xs text-emerald-400 font-semibold flex items-center gap-1">
              View Analytics &rarr;
            </div>
          </div>

          {/* Module 6 */}
          <div
            onClick={onOpenDossier}
            className="p-6 rounded-2xl bg-slate-900/60 border border-white/[0.07] hover:border-orange-500/40 transition-all cursor-pointer group space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-400 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300">
                100 Points
              </span>
            </div>
            <h4 className="text-base font-bold text-white group-hover:text-orange-300 transition-colors">
              Round 2 Submission Pack
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Complete technical architecture, APIs, datasets, evidence of user testing, and team member contribution breakdown.
            </p>
            <div className="pt-2 text-xs text-orange-400 font-semibold flex items-center gap-1">
              Inspect Rubric Guide &rarr;
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer Section */}
      <section className="max-w-4xl mx-auto px-4 text-center">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-amber-950/30 border border-cyan-500/30 shadow-2xl space-y-4">
          <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
            Ready to test Proofline in action?
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
            Experience how the Change-Impact Intelligence Engine prevents costly brand errors and invalidates stale marketing claims across public channels.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => onLaunchApp('impact')}
              className="px-6 py-3 text-xs font-bold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/30 transition-all flex items-center gap-2"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Enter Workspace Console</span>
            </button>
            <button
              onClick={onStartTour}
              className="px-5 py-3 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Start 2-Min Guided Tour</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
