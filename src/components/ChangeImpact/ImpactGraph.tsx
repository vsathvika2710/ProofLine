import React from 'react';
import { AlertTriangle, CheckCircle2, ArrowRight, Share2 } from 'lucide-react';
import { ChangeImpactResult } from '../../types';

interface ImpactGraphProps { impactResult: ChangeImpactResult; onSelectAsset?: (assetId: string) => void; }

export const ImpactGraph: React.FC<ImpactGraphProps> = ({ impactResult, onSelectAsset }) => {
  const affected = impactResult.affectedAssets;
  const unaffected = impactResult.unaffectedAssets;
  return (
    <section className="relative w-full rounded-2xl bg-slate-950 border border-slate-800 p-5 lg:p-7 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400"><Share2 className="w-5 h-5" /></div>
          <div><h3 className="text-base font-bold text-white">Change Impact Results</h3>
            <p className="text-xs text-slate-400">Computed from the selected fact and current asset content.</p></div>
        </div>
        <div className="flex gap-3 text-xs font-mono text-slate-400">
          <span className="text-amber-300">{affected.length} affected</span><span className="text-emerald-300">{unaffected.length} unaffected</span>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-4">
          <div className="text-[10px] uppercase tracking-wider text-amber-300 font-mono mb-2">Changed approved fact</div>
          <div className="text-sm font-semibold text-white mb-3">{impactResult.factName || 'Selected fact'}</div>
          <div className="text-xs text-slate-400 line-through break-words">{impactResult.oldValue}</div>
          <div className="flex items-center gap-2 my-2 text-amber-400"><ArrowRight className="w-4 h-4"/><span className="text-[10px] font-mono">UPDATED TO</span></div>
          <div className="text-sm text-emerald-300 font-semibold break-words">{impactResult.newValue}</div>
        </div>
        <div className="hidden lg:flex items-center justify-center text-slate-600"><ArrowRight className="w-6 h-6" /></div>
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Content assets scanned: {impactResult.totalAssetsScanned}</div>
          {affected.length === 0 && <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 text-sm text-emerald-300">No affected assets were detected by the current rules.</div>}
          {affected.map(asset => <button key={asset.assetId} onClick={() => onSelectAsset?.(asset.assetId)} className="w-full text-left rounded-xl border border-amber-500/25 bg-amber-950/10 p-3 hover:border-amber-400/60 transition-colors">
            <div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold text-white">{asset.assetTitle}</span><AlertTriangle className="w-4 h-4 text-amber-400 shrink-0"/></div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">{asset.assetType} · {asset.assetId}</div>
            {asset.affectedClaims.map((claim, i) => <div key={i} className="mt-2 border-t border-slate-800 pt-2"><p className="text-xs text-amber-200">{claim.claimText}</p><p className="text-[11px] text-slate-400 mt-1">{claim.reason}</p><p className="text-[11px] text-emerald-300 mt-1">Suggested fix: {claim.suggestedFix}</p></div>)}
          </button>)}
          {unaffected.map(asset => <div key={asset.assetId} className="rounded-xl border border-emerald-500/15 bg-emerald-950/5 p-3">
            <div className="flex items-start justify-between gap-2"><span className="text-sm text-slate-300">{asset.assetTitle}</span><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0"/></div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">{asset.assetId}</div><p className="text-[11px] text-slate-400 mt-1">{asset.checkedReason}</p>
          </div>)}
        </div>
      </div>
      <p className="text-[10px] text-slate-500 mt-4">Rule-based demo analysis. Results depend on the current sample content and implemented detection rules.</p>
    </section>
  );
};
