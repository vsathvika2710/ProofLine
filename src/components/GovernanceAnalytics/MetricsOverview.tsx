import React from 'react';
import {
  BarChart3,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Clock,
  PieChart,
  FileText,
  Users,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Fact, EvidenceDocument, ContentAsset } from '../../types';

interface MetricsOverviewProps {
  facts: Fact[];
  documents: EvidenceDocument[];
  assets: ContentAsset[];
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({ facts, documents, assets }) => {
  const expiringDocs = documents.filter((d) => d.status === 'expiring_soon');

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Governance Analytics</h2>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Module 6 · Enterprise Risk Intelligence
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Aggregate insights into recurring brand mistakes, guideline ambiguities, and policy drift
            across campaigns.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>Real-time Telemetry: Live</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-mono uppercase font-semibold">Brand Health Index</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-white font-mono">89%</div>
          <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1 font-medium">
            <TrendingUp className="w-3 h-3" />
            +14% since Change Impact Engine deployed
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-mono uppercase font-semibold">Stale Claims Blocked</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-black text-white font-mono">142</div>
          <div className="mt-2 text-xs text-slate-400 font-medium">
            Pre-publication catches in Q4
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-mono uppercase font-semibold">Review Overhead Saved</span>
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-black text-white font-mono">78%</div>
          <div className="mt-2 text-xs text-cyan-400 font-medium">
            Only truly affected assets flagged
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-mono uppercase font-semibold">Active Vault Proofs</span>
            <FileText className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-black text-white font-mono">{facts.length}</div>
          <div className="mt-2 text-xs text-slate-400 font-medium">
            Across {documents.length} verified documents
          </div>
        </div>
      </div>

      {/* Middle Row: Survey Validation (Slide 3 & 4) & Top Outdated Facts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Survey Insights Matching Pitch Deck (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                Customer Problem Validation (Round 1 Survey)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Empirical evidence from our 20-respondent brand governance study (Slide 3 &amp; 4).
              </p>
            </div>
            <span className="text-xs font-mono text-cyan-400 font-bold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
              N = 20
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
              <div className="text-2xl font-black text-cyan-400 font-mono">19 / 20</div>
              <div className="text-xs text-slate-300 font-medium mt-1">
                Said an automated platform would be very useful
              </div>
              <div className="text-[10px] text-slate-500 mt-1">95% perceived usefulness</div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
              <div className="text-2xl font-black text-amber-400 font-mono">15 / 20</div>
              <div className="text-xs text-slate-300 font-medium mt-1">
                Said brand guidelines are not regularly updated
              </div>
              <div className="text-[10px] text-slate-500 mt-1">75% guideline staleness</div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
              <div className="text-2xl font-black text-red-400 font-mono">11 / 20</div>
              <div className="text-xs text-slate-300 font-medium mt-1">
                Found it very difficult to keep content aligned
              </div>
              <div className="text-[10px] text-slate-500 mt-1">55% cross-team friction</div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
              <div className="text-2xl font-black text-purple-400 font-mono">7 / 20</div>
              <div className="text-xs text-slate-300 font-medium mt-1">
                Ranked consistent brand language as #1 challenge
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Tone &amp; naming drift</div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Feature Demand Priority:</span>{' '}
            Outdated claims (10/20) &bull; Accessibility checks (10/20) &bull; Visual consistency (9/20) &bull; Claim verification (7/20).
          </div>
        </div>

        {/* Right: Recurring Brand Risks & Expiry Radar (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-400" />
              Top Recurring Governance Issues
            </h3>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Superseded Warranty Duration (2yr vs 1yr)</span>
                  <span className="font-mono text-amber-400 font-semibold">42%</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div className="bg-amber-400 h-full rounded-full" style={{ width: '42%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Prohibited Superlatives ("100% waterproof")</span>
                  <span className="font-mono text-red-400 font-semibold">28%</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div className="bg-red-400 h-full rounded-full" style={{ width: '28%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Non-compliant Colorway Terms ("Dark Blue")</span>
                  <span className="font-mono text-purple-400 font-semibold">18%</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div className="bg-purple-400 h-full rounded-full" style={{ width: '18%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">Outdated Return Window (30d vs 14d)</span>
                  <span className="font-mono text-cyan-400 font-semibold">12%</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div className="bg-cyan-400 h-full rounded-full" style={{ width: '12%' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Expiry Radar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Evidence Expiry Radar
              </span>
              <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                Action Required
              </span>
            </div>
            <p className="text-xs text-slate-400">
              <span className="text-slate-200 font-medium">NovaTech Master Brand Guidelines</span>{' '}
              expires on Dec 1, 2026. Scheduled review task automatically queued for Brand Lead Liam Kelly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
