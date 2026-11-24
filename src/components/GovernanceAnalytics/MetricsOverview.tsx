import React from 'react';
import { ShieldCheck, AlertTriangle, FileText, Clock, BarChart3 } from 'lucide-react';
import { Fact, EvidenceDocument, ContentAsset } from '../../types';
interface MetricsOverviewProps {
  facts: Fact[];
  documents: EvidenceDocument[];
  assets: ContentAsset[];
  dataSourceLabel?: string;
}
export const MetricsOverview: React.FC<MetricsOverviewProps> = ({
  facts,
  documents,
  assets,
  dataSourceLabel = 'current workspace fixture',
}) => {
  const expiringDocs = documents.filter(d => d.status === 'expiring_soon');
  const linkedAssets = assets.filter(a => (a.linkedFactIds || []).length > 0).length;
  const metrics = [
    { label: 'Approved facts in workspace', value: facts.length, detail: 'Current workspace data', icon: ShieldCheck, color: 'text-emerald-400' },
    { label: 'Content assets', value: assets.length, detail: 'Assets in the current workspace', icon: FileText, color: 'text-cyan-400' },
    { label: 'Assets with fact links', value: linkedAssets, detail: 'Have one or more linked fact IDs', icon: BarChart3, color: 'text-amber-400' },
    { label: 'Expiring documents', value: expiringDocs.length, detail: 'Marked expiring soon', icon: Clock, color: 'text-red-400' },
  ];
  return <div className="space-y-6">
    <header><h2 className="text-2xl font-semibold text-white tracking-tight">Governance Analytics</h2><p className="text-xs text-slate-400 mt-1">Counts use {dataSourceLabel}; they are not live production telemetry.</p></header>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{metrics.map(m => <div key={m.label} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5"><div className="flex justify-between items-center text-slate-400 mb-2"><span className="text-[11px] uppercase tracking-wide">{m.label}</span><m.icon className={`w-4 h-4 ${m.color}`}/></div><div className="text-3xl font-black text-white font-mono">{m.value}</div><p className="mt-2 text-xs text-slate-400">{m.detail}</p></div>)}</div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5"><h3 className="font-semibold text-white mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400"/>Expiring documents</h3>{expiringDocs.length ? <ul className="space-y-2">{expiringDocs.map(d=><li key={d.id} className="text-sm text-slate-300 flex justify-between gap-3"><span>{d.title}</span><span className="text-amber-300 text-xs">Expiring soon</span></li>)}</ul> : <p className="text-sm text-slate-400">No documents are marked as expiring soon.</p>}</section>
    <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5"><h3 className="font-semibold text-white mb-3">Workspace inventory</h3><div className="space-y-2 text-sm text-slate-300"><div className="flex justify-between"><span>Evidence documents</span><span className="font-mono">{documents.length}</span></div><div className="flex justify-between"><span>Approved facts</span><span className="font-mono">{facts.length}</span></div><div className="flex justify-between"><span>Content assets</span><span className="font-mono">{assets.length}</span></div></div></section></div>
  </div>;
};
