import React, { useState } from 'react';
import {
  FileText,
  Calendar,
  User,
  ShieldCheck,
  CheckCircle,
  ExternalLink,
  Search,
  Filter,
  Plus,
  Zap,
  Tag,
  Clock,
  Eye,
  X,
} from 'lucide-react';
import { Fact, EvidenceDocument } from '../../types';

interface FactListProps {
  facts: Fact[];
  documents: EvidenceDocument[];
  onSelectFactForImpact: (factId: string) => void;
  onAddNewFact: (newFact: Fact) => void;
  readOnly?: boolean;
}

export const FactList: React.FC<FactListProps> = ({
  facts,
  documents,
  onSelectFactForImpact,
  onAddNewFact,
  readOnly = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedDoc, setSelectedDoc] = useState<EvidenceDocument | null>(null);
  const [selectedFact, setSelectedFact] = useState<Fact | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state for new fact
  const [newCode, setNewCode] = useState(`FACT-NEW-0${facts.length + 1}`);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<Fact['category']>('Product Specs');
  const [newValue, setNewValue] = useState('');
  const [newOwner, setNewOwner] = useState('Sarah Chen (Legal)');
  const [newDocId, setNewDocId] = useState(documents[0]?.id || '');
  const [newPassage, setNewPassage] = useState('');

  const categories = ['ALL', 'Product Specs', 'Pricing & Policy', 'Ingredients & Storage', 'Brand Identity'];

  const filteredFacts = facts.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.currentValue.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = categoryFilter === 'ALL' || f.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleCreateFact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newValue.trim() || !newPassage.trim()) return;

    const doc = documents.find((d) => d.id === newDocId);
    const created: Fact = {
      id: newCode,
      code: newCode,
      name: newName,
      category: newCategory,
      currentValue: newValue,
      lastUpdated: new Date().toISOString().split('T')[0],
      version: 'v1.0',
      owner: newOwner,
      status: 'active',
      sourceDocId: doc?.id || '',
      sourceDocName: doc?.title || 'Manual citation',
      sourcePassage: newPassage.trim(),
      effectiveDate: new Date().toISOString().split('T')[0],
      expiryDate: '2027-12-31',
      tags: [newCategory.toLowerCase().replace(/\s+/g, '-')],
    };

    onAddNewFact(created);
    setShowAddModal(false);
    setNewName('');
    setNewValue('');
    setNewPassage('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Evidence Vault</h2>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {facts.length} Facts
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Facts and source citations available in this workspace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            disabled={readOnly}
            title={readOnly ? 'Fact changes are not persisted to organization records.' : undefined}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-md shadow-cyan-900/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add Approved Fact
          </button>
        </div>
      </div>

      {/* Documents Overview Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {documents.map((doc) => (
          <div
            key={doc.id}
            onClick={() => setSelectedDoc(doc)}
            className="bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-4 transition-all cursor-pointer group shadow-md"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-semibold">
                {doc.docNumber}
              </span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  doc.status === 'valid'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}
              >
                {doc.status.toUpperCase().replace('_', ' ')}
              </span>
            </div>
            <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
              {doc.title}
            </h4>
            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{doc.summary}</p>
            <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-800/80">
              <span>{doc.owner}</span>
              <span className="flex items-center gap-1 text-cyan-400">
                <Eye className="w-3 h-3" /> View Source
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/70 border border-slate-800 rounded-xl p-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search approved facts, tags, codes or source documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-500 ml-1" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 text-xs rounded-lg transition-all font-medium whitespace-nowrap ${
                categoryFilter === cat
                  ? 'bg-cyan-600 text-white font-semibold'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Facts Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-[11px] font-mono uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Code / Attribute</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Approved Truth Value</th>
                <th className="py-3 px-4">Source Evidence Citation</th>
                <th className="py-3 px-4">Owner &amp; Dates</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {filteredFacts.map((fact) => (
                <tr key={fact.id} className="hover:bg-slate-850/60 transition-colors">
                  {/* Code and Name */}
                  <td className="py-3.5 px-4 font-sans">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold border border-slate-700">
                        {fact.code}
                      </span>
                      <span className="font-semibold text-white">{fact.name}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {fact.tags.map((t) => (
                        <span key={t} className="text-[9px] text-slate-500 font-mono">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Category */}
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                      {fact.category}
                    </span>
                  </td>

                  {/* Truth Value */}
                  <td className="py-3.5 px-4 max-w-xs">
                    <div className="text-emerald-400 font-semibold bg-emerald-950/30 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg">
                      {fact.currentValue}
                    </div>
                    {fact.previousValue && (
                      <div className="text-[10px] text-slate-500 line-through mt-1">
                        Prev: {fact.previousValue}
                      </div>
                    )}
                  </td>

                  {/* Source Evidence */}
                  <td className="py-3.5 px-4 max-w-xs font-sans">
                    <div className="text-white font-medium text-[11px] flex items-center gap-1">
                      <FileText className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span className="truncate">{fact.sourceDocName}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5 font-mono">
                      "{fact.sourcePassage}"
                    </p>
                  </td>

                  {/* Owner & Dates */}
                  <td className="py-3.5 px-4 text-slate-400 text-[11px] font-sans">
                    <div>{fact.owner}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Ver: {fact.version} · Exp: {fact.expiryDate}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setSelectedFact(fact)}
                        className="px-2 py-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                        title="View Full Detail"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onSelectFactForImpact(fact.id)}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all flex items-center gap-1"
                        title="Analyze Impact of changing this fact"
                      >
                        <Zap className="w-3 h-3 text-amber-400" />
                        Test Impact
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Document Inspector Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setSelectedDoc(null)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>OFFICIAL APPROVED SOURCE DOCUMENT</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-1">{selectedDoc.title}</h3>
            <p className="text-xs text-slate-400 mb-4 font-mono">
              Document No: {selectedDoc.docNumber} · Version: {selectedDoc.version} · Owner:{' '}
              {selectedDoc.owner}
            </p>

            <div className="space-y-4">
              {selectedDoc.sections.map((sec, idx) => (
                <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h5 className="text-xs font-bold text-cyan-300 font-mono mb-1.5">{sec.heading}</h5>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">{sec.text}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedDoc(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-white"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fact Detail Modal */}
      {selectedFact && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedFact(null)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold uppercase">
              {selectedFact.code}
            </span>
            <h3 className="text-lg font-bold text-white mt-2 mb-4">{selectedFact.name}</h3>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-mono mb-1">
                  Approved Value:
                </span>
                <span className="text-emerald-400 font-semibold">{selectedFact.currentValue}</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-mono mb-1">
                  Source Citation:
                </span>
                <span className="text-white font-medium">{selectedFact.sourceDocName}</span>
                <p className="text-slate-400 mt-1 italic">"{selectedFact.sourcePassage}"</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-slate-400 text-[11px] font-mono">
                <div>Owner: {selectedFact.owner}</div>
                <div>Version: {selectedFact.version}</div>
                <div>Effective: {selectedFact.effectiveDate}</div>
                <div>Expires: {selectedFact.expiryDate}</div>
              </div>
            </div>

            <div className="mt-6 flex justify-between gap-3">
              <button
                onClick={() => {
                  onSelectFactForImpact(selectedFact.id);
                  setSelectedFact(null);
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono"
              >
                <Zap className="w-3.5 h-3.5" />
                Test Impact on Live Assets
              </button>
              <button
                onClick={() => setSelectedFact(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Fact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-4">Add Approved Fact / Guideline</h3>

            <form onSubmit={handleCreateFact} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Attribute Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Maximum Operating Temperature"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as Fact['category'])}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="Product Specs">Product Specs</option>
                    <option value="Pricing & Policy">Pricing & Policy</option>
                    <option value="Ingredients & Storage">Ingredients & Storage</option>
                    <option value="Brand Identity">Brand Identity</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1">Fact Code</label>
                  <input
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  Approved Truth Value
                </label>
                <input
                  type="text"
                  required
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="e.g. -10°C to 50°C operational range"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-semibold text-emerald-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  Source Evidence Document{documents.length ? '' : ' (optional)'}
                </label>
                <select
                  required={documents.length > 0}
                  value={newDocId}
                  onChange={(e) => setNewDocId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                >
                  {!documents.length && <option value="">Manual citation</option>}
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.docNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  Exact Source Quotation / Passage
                </label>
                <textarea
                  rows={2}
                  required
                  value={newPassage}
                  onChange={(e) => setNewPassage(e.target.value)}
                  placeholder="Quote the exact section from the specification or policy"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                >
                  Save to Evidence Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
