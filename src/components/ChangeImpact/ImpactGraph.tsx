import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Layers,
  FileText,
  Clock,
  ChevronRight,
  Share2,
} from 'lucide-react';
import { ChangeImpactResult } from '../../types';

interface ImpactGraphProps {
  impactResult: ChangeImpactResult;
  onSelectAsset?: (assetId: string) => void;
}

export const ImpactGraph: React.FC<ImpactGraphProps> = ({ impactResult, onSelectAsset }) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('fact');
  const [hoveredPath, setHoveredPath] = useState<number | null>(null);

  const claimsData = [
    {
      id: 'claim-1',
      index: 0,
      text: '"2-year warranty"',
      assetTitle: 'SmartWatch X Landing Page',
      assetType: 'Website Page',
      assetId: 'ASSET-WEB-01',
      affected: true,
      action: 'Approval Invalidated',
      sourceDoc: 'Warranty Policy v3.2 · §4.1',
      diff: 'Must update to: "1-year limited warranty"',
    },
    {
      id: 'claim-2',
      index: 1,
      text: '"Two-year warranty"',
      assetTitle: 'B2B Sales Brochure (PDF)',
      assetType: 'Sales PDF',
      assetId: 'ASSET-BRO-02',
      affected: true,
      action: 'Approval Invalidated',
      sourceDoc: 'Warranty Policy v3.2 · §4.1',
      diff: 'Must update to: "1-year manufacturer coverage"',
    },
    {
      id: 'claim-3',
      index: 2,
      text: '"Two years of coverage"',
      assetTitle: 'Instagram Video Ad Copy',
      assetType: 'Social Campaign',
      assetId: 'ASSET-SOC-03',
      affected: true,
      action: 'Approval Invalidated',
      sourceDoc: 'Warranty Policy v3.2 · §4.1',
      diff: 'Must update to: "1-year warranty protection"',
    },
    {
      id: 'claim-4',
      index: 3,
      text: '"Available in Midnight Blue"',
      assetTitle: 'Finishes & Colours Page',
      assetType: 'Website Page',
      assetId: 'ASSET-COL-04',
      affected: false,
      action: 'Approved & Stable',
      sourceDoc: 'Brand Guidelines · §3.4',
      diff: 'Attribute independent of warranty policy',
    },
  ];

  return (
    <div className="relative w-full rounded-3xl bg-[#090d18] border border-white/[0.09] shadow-2xl overflow-hidden p-6 lg:p-8">
      {/* Ambient background glows */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-indigo-500/[0.04] rounded-full blur-[120px] pointer-events-none"></div>

      {/* Top Header Bar */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-inner">
            <Share2 className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                Live Cascade Dependency Graph
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                CASCADE ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Interactive 3-tier propagation topology: Fact Delta &rarr; Linked Claims &rarr; Public Collateral.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
            <span className="text-slate-300">1 Delta Propagated</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
            <span className="text-red-400 font-bold">3 Invalidation Events</span>
          </div>
        </div>
      </div>

      {/* 3-Column Visual Canvas */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Tier 1: Approved Fact (Left 4 cols) */}
        <div className="lg:col-span-4 flex flex-col justify-center">
          <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            Tier 1 · Mutated Ground Truth
          </div>

          <div
            onClick={() => setSelectedNodeId('fact')}
            className={`cursor-pointer rounded-2xl p-5 border transition-all duration-300 relative group bg-gradient-to-b from-[#131929] to-[#0c101c] ${
              selectedNodeId === 'fact'
                ? 'border-amber-400/80 shadow-2xl shadow-amber-500/20 ring-2 ring-amber-400/20'
                : 'border-white/[0.08] hover:border-amber-400/40'
            }`}
          >
            {/* Concentric radar beacon */}
            <div className="absolute -top-3 -right-3 flex items-center justify-center">
              <span className="relative flex h-6 w-6">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60"></span>
                <span className="relative inline-flex rounded-full h-6 w-6 bg-amber-500/40 border border-amber-400 text-[10px] text-amber-200 font-mono font-bold items-center justify-center">
                  &Delta;
                </span>
              </span>
            </div>

            <div className="text-[10px] font-mono text-amber-400/90 font-bold tracking-wider uppercase mb-1">
              {impactResult.factId} · Active Fact
            </div>
            <h4 className="text-base font-bold text-white mb-3">{impactResult.factName}</h4>

            {/* Old vs New Value Diff Pill */}
            <div className="bg-[#070a12] border border-white/[0.06] rounded-xl p-3.5 space-y-2 font-mono text-xs shadow-inner">
              <div className="flex items-center gap-2 text-red-400/80 line-through">
                <span className="text-[9px] uppercase font-bold text-slate-500 w-10">OLD:</span>
                <span className="truncate">{impactResult.oldValue}</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <span className="text-[9px] uppercase font-bold text-slate-400 w-10">NEW:</span>
                <span className="flex items-center gap-1.5 truncate">
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  {impactResult.newValue}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1 font-mono">
                <FileText className="w-3.5 h-3.5 text-cyan-400" /> Warranty Policy v3.2
              </span>
              <span className="text-emerald-400 font-mono font-semibold">Legal Certified</span>
            </div>
          </div>
        </div>

        {/* Tier 2: Dependent Claims (Middle 4 cols) */}
        <div className="lg:col-span-4 flex flex-col justify-center space-y-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-bold mb-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            Tier 2 · Dependent Extracted Claims
          </div>

          {claimsData.map((claim) => (
            <div
              key={claim.id}
              onClick={() => setSelectedNodeId(claim.id)}
              onMouseEnter={() => setHoveredPath(claim.index)}
              onMouseLeave={() => setHoveredPath(null)}
              className={`rounded-2xl p-3.5 border transition-all duration-200 cursor-pointer ${
                claim.affected
                  ? selectedNodeId === claim.id || hoveredPath === claim.index
                    ? 'bg-amber-950/30 border-amber-400 shadow-lg shadow-amber-950/30 ring-1 ring-amber-400/30'
                    : 'bg-[#0f1424] border-amber-500/30 hover:border-amber-400/60'
                  : 'bg-[#0b0e18] border-white/[0.05] opacity-65 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-white font-mono">{claim.text}</span>
                {claim.affected ? (
                  <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                    Superseded
                  </span>
                ) : (
                  <span className="text-[9px] font-mono font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                    Stable
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>In: {claim.assetType}</span>
                <span className="text-[10px] text-slate-500 font-mono">{claim.sourceDoc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tier 3: Content Assets (Right 4 cols) */}
        <div className="lg:col-span-4 flex flex-col justify-center space-y-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-purple-400 font-bold mb-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
            Tier 3 · Public Collateral Governance
          </div>

          {claimsData.map((claim) => (
            <div
              key={`asset-${claim.id}`}
              onClick={() => onSelectAsset && onSelectAsset(claim.assetId)}
              onMouseEnter={() => setHoveredPath(claim.index)}
              onMouseLeave={() => setHoveredPath(null)}
              className={`rounded-2xl p-3.5 border transition-all duration-200 cursor-pointer group ${
                claim.affected
                  ? selectedNodeId === claim.id || hoveredPath === claim.index
                    ? 'bg-red-950/40 border-red-400 shadow-xl shadow-red-950/40'
                    : 'bg-[#121626] border-red-500/30 hover:border-red-400'
                  : 'bg-[#0b0e18] border-white/[0.05] opacity-65 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                  {claim.assetTitle}
                </span>
                <span
                  className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    claim.affected
                      ? 'bg-red-500/20 text-red-300 border-red-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {claim.action}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{claim.diff}</p>
              <div className="mt-2 pt-2 border-t border-white/[0.05] flex items-center justify-between text-[10px] text-slate-500">
                <span>Channel: {claim.assetType}</span>
                <span className="text-cyan-400 font-semibold group-hover:underline flex items-center gap-0.5">
                  Inspect Diff <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Explanatory Footer Pill */}
      <div className="mt-8 pt-5 border-t border-white/[0.06] grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400">
        <div className="bg-[#0b0f1c] p-3.5 rounded-xl border border-white/[0.05]">
          <span className="text-amber-400 font-bold block mb-1 font-mono">1. Instant Delta Invalidation</span>
          When FACT-WTY-01 was reduced to 1 year, 3 dependent assets lost approved status in &lt;10ms.
        </div>
        <div className="bg-[#0b0f1c] p-3.5 rounded-xl border border-white/[0.05]">
          <span className="text-cyan-400 font-bold block mb-1 font-mono">2. Zero False Positive Burden</span>
          Independent assets (Colours Page) were verified and preserved as stable without review spam.
        </div>
        <div className="bg-[#0b0f1c] p-3.5 rounded-xl border border-white/[0.05]">
          <span className="text-purple-400 font-bold block mb-1 font-mono">3. Human Review Dispatch</span>
          Suggested diffs were automatically queued for Legal Reviewer Sarah Chen with 1-click approvals.
        </div>
      </div>
    </div>
  );
};
