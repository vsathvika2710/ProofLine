import React, { useState } from 'react';
import {
  Zap,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Send,
  Sliders,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Layers,
  History,
} from 'lucide-react';
import { Fact, ContentAsset, ChangeImpactResult, ReviewTask } from '../../types';
import { ImpactGraph } from './ImpactGraph';
import { runChangeImpactSimulation } from '../../services/claimEngine';

interface ImpactDashboardProps {
  facts: Fact[];
  assets: ContentAsset[];
  onFactUpdated: (updatedFact: Fact, impact: ChangeImpactResult) => void | ChangeImpactResult | Promise<void | ChangeImpactResult>;
  onNavigateToReviews: () => void;
  professionalMode?: boolean;
  allowCommit?: boolean;
}

export const ImpactDashboard: React.FC<ImpactDashboardProps> = ({
  facts,
  assets,
  onFactUpdated,
  onNavigateToReviews,
  professionalMode = false,
  allowCommit = true,
}) => {
  const [selectedFactId, setSelectedFactId] = useState<string>(facts[0]?.id || 'FACT-WTY-01');
  const [customValue, setCustomValue] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [hasRunAnalysis, setHasRunAnalysis] = useState(false);
  const [commitError, setCommitError] = useState('');
  const [lastImpactResult, setLastImpactResult] = useState<ChangeImpactResult>(() =>
    runChangeImpactSimulation(
      facts[0]?.id || 'FACT-WTY-01',
      '1 year limited manufacturer warranty',
      facts,
      assets
    )
  );

  const selectedFact = facts.find((f) => f.id === selectedFactId) || facts[0];

  const handleRunSimulation = (factId = selectedFactId, value = customValue) => {
    setIsSimulating(true);
    // Capture inputs before the delay so the analysis cannot read stale React state.
    const result = runChangeImpactSimulation(factId, value, facts, assets);
    setTimeout(() => {
      setLastImpactResult(result);
      setHasRunAnalysis(true);
      setIsSimulating(false);
    }, 250);
  };

  const simulationIsCurrent = hasRunAnalysis
    && lastImpactResult.factId === selectedFactId
    && lastImpactResult.newValue === customValue
    && (selectedFact?.currentValue === lastImpactResult.oldValue || selectedFact?.currentValue === lastImpactResult.newValue);

  const handleApplyFactChange = async () => {
    if (!allowCommit || !selectedFact || !simulationIsCurrent || customValue.trim() === selectedFact.currentValue.trim()) return;
    const updatedFact: Fact = {
      ...selectedFact,
      previousValue: selectedFact.currentValue,
      currentValue: customValue,
      lastUpdated: new Date().toISOString().split('T')[0],
      version: `v${(parseFloat(selectedFact.version.replace('v', '')) + 0.1).toFixed(1)}`,
    };
    setIsCommitting(true);
    setCommitError('');
    try {
      const committedImpact = await onFactUpdated(updatedFact, lastImpactResult);
      if (committedImpact) {
        setLastImpactResult(committedImpact);
        setHasRunAnalysis(true);
        setSelectedFactId(committedImpact.factId);
        setCustomValue(committedImpact.newValue);
      }
    } catch (cause) {
      setCommitError(cause instanceof Error ? cause.message : 'The fact change could not be committed.');
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {professionalMode ? (
        <header>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Change Impact Engine</h2>
          <p className="mt-1 text-sm text-slate-400">Analyze affected claims and assets when an approved fact changes.</p>
        </header>
      ) : (
      /* Top Banner & Value Proposition */
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold font-mono tracking-wide">
                <Zap className="w-3.5 h-3.5 fill-amber-400" />
                SIGNATURE INNOVATION · MODULE 4
              </span>
              <span className="text-xs text-slate-400 font-mono">Rule-Based Impact Analysis</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Change-Impact Intelligence
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              When business facts change (warranties, prices, ingredients, policies), Proofline
              automatically walks the dependency graph to find all affected public copy, invalidates stale
              approvals, and routes suggested diffs to human review.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!professionalMode && <button
              onClick={() => {
                const warranty = facts.find(f => f.code === 'FACT-WTY-01') || facts.find(f => f.name.toLowerCase().includes('warranty'));
                if (!warranty) return;
                const demoValue = '1 year limited manufacturer warranty';
                setSelectedFactId(warranty.id);
                setCustomValue(demoValue);
                handleRunSimulation(warranty.id, demoValue);
              }}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              Demo: Warranty 2yr &rarr; 1yr
            </button>}
            <button
              onClick={onNavigateToReviews}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/30 transition-all flex items-center gap-2"
            >
              <span>Go to Human Review Centre</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Slide 8 / Round 2 Prompt Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="text-[11px] uppercase tracking-wider font-mono font-semibold text-amber-400 mb-1">
            Impact Summary
          </div>
          <div className="text-3xl font-black text-white font-mono">{simulationIsCurrent ? '1' : '—'}</div>
          <div className="text-xs text-slate-300 mt-1 font-semibold">fact analyzed</div>
          <div className="mt-3 text-[11px] text-amber-300 font-mono bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 truncate">
            {simulationIsCurrent ? `${selectedFact?.name}: ${selectedFact?.currentValue} → ${customValue}` : 'Run analysis to view proposed change'}
          </div>
        </div>

        <div className="bg-slate-900/80 border border-red-500/30 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="text-[11px] uppercase tracking-wider font-mono font-semibold text-red-400 mb-1">
            Cascade Impact
          </div>
          <div className="text-3xl font-black text-white font-mono">
            {simulationIsCurrent ? lastImpactResult.affectedAssets.length : '—'}
          </div>
          <div className="text-xs text-slate-300 mt-1 font-semibold">
            items need review
          </div>
          <div className="mt-3 text-[11px] text-red-300 font-mono bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
            {simulationIsCurrent ? 'Based on the latest analysis' : 'Run analysis to calculate impact'}
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="text-[11px] uppercase tracking-wider font-mono font-semibold text-slate-400 mb-1">
            Precision Filter
          </div>
          <div className="text-3xl font-black text-white font-mono">
            {simulationIsCurrent ? lastImpactResult.unaffectedAssets.length : '—'}
          </div>
          <div className="text-xs text-slate-300 mt-1 font-semibold">
            checked, not affected
          </div>
          <div className="mt-3 text-[11px] text-slate-300 font-mono bg-slate-800/80 px-2 py-1 rounded border border-slate-700">
            {simulationIsCurrent ? 'Based on current rule checks' : 'No analysis run yet'}
          </div>
        </div>
      </div>

      {/* Simulator Control Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
              Select Approved Fact to Mutate:
            </label>
            <select
              value={selectedFactId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedFactId(id);
                const found = facts.find((f) => f.id === id);
                if (found) setCustomValue('');
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
            >
              {facts.map((f) => (
                <option key={f.id} value={f.id}>
                  [{f.code}] {f.name} ({f.currentValue})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
              New Fact Value (Pending Policy Revision):
            </label>
            <input
              type="text"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              placeholder="e.g. 1 year limited warranty"
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
          <button
            onClick={() => handleRunSimulation()}
            disabled={isSimulating || !selectedFact || !customValue.trim()}
            className="flex-1 md:flex-initial px-4 py-2.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all font-mono shadow-md flex items-center justify-center gap-2"
          >
            {isSimulating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            Run Cascade Analysis
          </button>

          <button
            onClick={handleApplyFactChange}
            disabled={!allowCommit || isCommitting || !simulationIsCurrent || !selectedFact || customValue.trim() === selectedFact.currentValue.trim()}
            className="flex-1 md:flex-initial px-4 py-2.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-500 text-white transition-all font-mono shadow-md flex items-center justify-center gap-2"
            title={!allowCommit ? 'Fact changes are not persisted to organization records.' : 'Commit only after running analysis for the current input'}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            {isCommitting ? 'Saving…' : 'Commit & Invalidate'}
          </button>
        </div>
      </div>

      {hasRunAnalysis && !simulationIsCurrent && <p className="text-xs text-amber-300">Inputs changed since the last analysis. Run analysis again before committing.</p>}
      {commitError && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{commitError}</p>}

      {/* Visual Dependency & Cascade Graph */}
      {simulationIsCurrent
        ? <ImpactGraph impactResult={lastImpactResult} />
        : <p className="rounded-xl border border-[var(--pl-border)] bg-[var(--pl-surface)] p-5 text-sm text-[var(--pl-muted)]">Run analysis to view dependent claims and content assets.</p>}

      {/* Affected Assets Detailed Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Impact Invalidation Register
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {simulationIsCurrent
                ? 'Assets identified by the latest analysis. Human review is required before publishing changes.'
                : 'Run analysis to identify affected assets and review tasks.'}
            </p>
          </div>
          <button
            onClick={onNavigateToReviews}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
          >
            View all in Review Queue &rarr;
          </button>
        </div>

        <div className="overflow-x-auto">
          {simulationIsCurrent ? <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] font-mono uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Asset</th>
                <th className="py-3 px-4">Claim found</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {lastImpactResult.affectedAssets.map((asset) => (
                <tr key={asset.assetId} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-sans font-semibold text-white">
                    <div>{asset.assetTitle}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{asset.channel || asset.assetType}</div>
                  </td>
                  <td className="py-3.5 px-4 text-amber-300 font-semibold">
                    "{asset.affectedClaims[0]?.claimText || 'Detected claim'}"
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      NEEDS REVIEW
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={onNavigateToReviews}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/30 transition-all"
                    >
                      Open Diff &rarr;
                    </button>
                  </td>
                </tr>
              ))}
              {lastImpactResult.unaffectedAssets.map((asset) => (
                <tr key={asset.assetId} className="hover:bg-slate-800/20">
                  <td className="py-3.5 px-4 font-sans text-slate-300">
                    <div>{asset.assetTitle}</div>
                    <div className="text-[10px] text-slate-400 font-mono">Asset type</div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 italic">
                    {asset.checkedReason}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                      CHECKED, NOT AFFECTED
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-400 font-mono text-[11px]">No review needed</td>
                </tr>
              ))}
            </tbody>
          </table> : <p className="px-4 py-6 text-sm text-slate-400">No analysis results to display.</p>}
        </div>
      </div>
    </div>
  );
};
