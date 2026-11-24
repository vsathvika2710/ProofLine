import React, { useState } from 'react';
import {
  UserCheck2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  History,
  FileText,
  Filter,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  Edit3,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ReviewTask, UserRole, AuditLogEntry } from '../../types';

interface ReviewQueueProps {
  tasks: ReviewTask[];
  auditLogs: AuditLogEntry[];
  activeRole: UserRole;
  onUpdateTask: (task: ReviewTask, log: AuditLogEntry) => void | Promise<void>;
  readOnly?: boolean;
  professionalMode?: boolean;
}

export const ReviewQueue: React.FC<ReviewQueueProps> = ({
  tasks,
  auditLogs,
  activeRole,
  onUpdateTask,
  readOnly = false,
  professionalMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'audit'>('queue');
  const [selectedTask, setSelectedTask] = useState<ReviewTask | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [editedText, setEditedText] = useState<string>('');
  const [reviewNote, setReviewNote] = useState<string>('');
  const [decisionError, setDecisionError] = useState('');
  const [savingDecision, setSavingDecision] = useState(false);

  const filteredTasks = tasks.filter((t) => {
    const matchesRole = roleFilter === 'ALL' || t.assignedRole === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesRole && matchesStatus;
  });

  const handleOpenTask = (task: ReviewTask) => {
    setSelectedTask(task);
    setEditedText(task.suggestedText);
    setReviewNote('');
    setDecisionError('');
  };

  const handleApprove = async () => {
    if (readOnly || !selectedTask || savingDecision) return;
    setSavingDecision(true);
    setDecisionError('');

    const updated: ReviewTask = {
      ...selectedTask,
      status: 'approved',
      currentText: editedText,
      reviewedBy: activeRole === 'legal_compliance' ? 'Sarah Chen (Legal)' : 'Liam Kelly (Brand)',
      reviewedAt: new Date().toISOString(),
      auditTrail: [
        ...selectedTask.auditTrail,
        {
          action: 'APPROVED_AND_RELEASED',
          by: activeRole === 'legal_compliance' ? 'Sarah Chen (Legal)' : 'Liam Kelly (Brand)',
          role: activeRole,
          timestamp: new Date().toISOString(),
          note: reviewNote || 'Approved suggested brand-compliant revision.',
        },
      ],
    };

    const newLog: AuditLogEntry = {
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actor: activeRole === 'legal_compliance' ? 'Sarah Chen' : 'Liam Kelly',
      role: activeRole,
      action: 'CONTENT_APPROVED',
      target: selectedTask.assetTitle,
      details: `Approved revision for publication. Review notes: "${reviewNote || 'Standard compliance approval'}"`,
    };

    try {
      await onUpdateTask(updated, newLog);
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
      setSelectedTask(null);
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : 'The review decision could not be saved.');
    } finally {
      setSavingDecision(false);
    }
  };

  const handleReject = async () => {
    if (readOnly || !selectedTask || savingDecision) return;
    setSavingDecision(true);
    setDecisionError('');

    const updated: ReviewTask = {
      ...selectedTask,
      status: 'rejected',
      reviewedBy: activeRole === 'legal_compliance' ? 'Sarah Chen (Legal)' : 'Liam Kelly (Brand)',
      reviewedAt: new Date().toISOString(),
      notes: reviewNote || 'Rejected due to outstanding compliance questions.',
      auditTrail: [
        ...selectedTask.auditTrail,
        {
          action: 'REJECTED_REVISION',
          by: activeRole === 'legal_compliance' ? 'Sarah Chen (Legal)' : 'Liam Kelly (Brand)',
          role: activeRole,
          timestamp: new Date().toISOString(),
          note: reviewNote || 'Rejected',
        },
      ],
    };

    const newLog: AuditLogEntry = {
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actor: activeRole === 'legal_compliance' ? 'Sarah Chen' : 'Liam Kelly',
      role: activeRole,
      action: 'OVERRIDE_GRANTED',
      target: selectedTask.assetTitle,
      details: `Rejected change. Rationale: "${reviewNote || 'Needs editorial re-drafting'}"`,
    };

    try {
      await onUpdateTask(updated, newLog);
      setSelectedTask(null);
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : 'The review decision could not be saved.');
    } finally {
      setSavingDecision(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Human Review Centre</h2>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Module 5 · Human Oversight Gate
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Proofline suggests and explains; people decide. Review diffs, approve corrections, and inspect
            the auditable decision ledger.
          </p>
        </div>

        {/* Queue vs Audit Trail Toggle */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'queue'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck2 className="w-3.5 h-3.5" />
            <span>Review Queue</span>
            {tasks.filter((t) => t.status === 'pending').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {tasks.filter((t) => t.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit Trail &amp; History</span>
          </button>
        </div>
      </div>

      {activeTab === 'queue' ? (
        <>
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Assigned Role:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              >
                <option value="ALL">All Roles</option>
                <option value="legal_compliance">Legal &amp; Compliance</option>
                <option value="brand_manager">Brand Manager</option>
                <option value="content_creator">Content Creator</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono text-slate-400 mr-1">Status:</span>
              {['ALL', 'pending', 'approved', 'rejected', 'modified'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 text-xs rounded-lg uppercase font-mono font-semibold transition-all ${
                    statusFilter === st
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {st === 'modified' ? 'revision requested' : st}
                </button>
              ))}
            </div>
          </div>

          {/* Tasks Grid / List */}
          <div className="grid grid-cols-1 gap-4">
            {filteredTasks.length === 0 ? (
              <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-500">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-400/60" />
                <h4 className="text-white font-semibold text-sm">Review Queue Clear!</h4>
                <p className="text-xs text-slate-400 mt-1">
                  No pending governance tasks match your filter criteria.
                </p>
              </div>
            ) : (
              filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xl transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-purple-300 font-bold border border-slate-700">
                        {task.id}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          task.priority === 'critical'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {task.priority.toUpperCase()} PRIORITY
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        Trigger:{' '}
                        <span className="text-slate-300 font-medium">
                          {task.trigger.replace(/_/g, ' ')}
                        </span>
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-white">{task.assetTitle}</h4>
                    <p className="text-xs text-slate-300 line-clamp-2 italic">
                      "{task.notes || task.originalText}"
                    </p>

                    <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono pt-1">
                      <span>Assigned: {task.assignedRole.replace('_', ' ')}</span>
                      <span>Created: {task.createdAt}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full uppercase ${
                        task.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : task.status === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}
                    >
                      {task.status}
                    </span>

                    <button
                      onClick={() => handleOpenTask(task)}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-900/30 transition-all flex items-center gap-1.5"
                    >
                      <span>Review Diff</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* Audit Trail Chronological Ledger */
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" />
                Immutable Governance Audit Ledger
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cryptographically tracked decisions: who updated facts, who invalidated approvals, and who signed off.
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-400">
              {professionalMode ? 'Governance event history' : 'SOC2 Type II Audit Ready'}
            </span>
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
            {auditLogs.map((log) => (
              <div key={log.id} className="relative group">
                <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-cyan-500 ring-4 ring-slate-950"></div>
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 text-xs font-mono space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-cyan-400 font-semibold">{log.action}</span>
                    <span className="text-[10px] text-slate-500">{log.timestamp}</span>
                  </div>
                  <div className="text-white font-medium font-sans">
                    Target: <span className="text-slate-300">{log.target}</span>
                  </div>
                  <p className="text-slate-400 font-sans">{log.details}</p>
                  <div className="pt-2 text-[10px] text-slate-500 flex items-center justify-between border-t border-slate-900">
                    <span>Actor: {log.actor} ({log.role})</span>
                    <span>Audit ID: {log.id}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Side-by-Side Diff Review Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => { if (!savingDecision) setSelectedTask(null); }}
              disabled={savingDecision}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2 text-xs font-mono text-cyan-400">
              <ShieldCheck className="w-4 h-4" />
              <span>CONTENT REVIEW &amp; DECISION</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-1">{selectedTask.assetTitle}</h3>
            <p className="text-xs text-slate-400 mb-6">
              Assigned Role: <span className="text-slate-300 font-semibold">{selectedTask.assignedRole}</span> · Priority:{' '}
              <span className="text-amber-400 font-semibold">{selectedTask.priority}</span>
            </p>

            {/* Side by Side Diff */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Original Column */}
              <div className="bg-slate-950 p-4 rounded-xl border border-red-500/30">
                <div className="flex items-center justify-between text-xs font-mono text-red-400 font-bold mb-2">
                  <span>Current / Flagged Copy</span>
                  <span className="text-[10px] bg-red-500/20 px-2 py-0.5 rounded">ORIGINAL</span>
                </div>
                <div className="text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-wrap bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  {selectedTask.originalText}
                </div>
              </div>

              {/* Proposed Replacement Column */}
              <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30">
                <div className="flex items-center justify-between text-xs font-mono text-emerald-400 font-bold mb-2">
                  <span>Suggested / Reviewer-edited Copy</span>
                  <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded">REVIEW COPY</span>
                </div>
                <textarea
                  rows={6}
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  readOnly={readOnly}
                  className="w-full bg-slate-900/60 border border-slate-700/80 rounded-lg p-3 text-xs text-emerald-300 font-sans leading-relaxed focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Reviewer Note */}
            <div className="mb-6">
              <label className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
                Reviewer Rationale &amp; Audit Note:
              </label>
              <input
                type="text"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                readOnly={readOnly}
                placeholder="e.g. Verified against Warranty Policy v3.2 Section 4.1. Approved for production deploy."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
              <div className="text-xs text-slate-500 font-mono">
                Acting as: <span className="text-slate-300">{activeRole}</span>
              </div>

              {readOnly ? <p className="text-xs text-amber-400">Review decisions are unavailable because this workspace is not connected to organization storage.</p> : <div className="flex items-center gap-2">
                <button
                  onClick={handleReject}
                  disabled={savingDecision}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 transition-all flex items-center gap-1.5 disabled:cursor-wait disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  <span>{savingDecision ? 'Saving…' : 'Reject / Request Redraft'}</span>
                </button>
                <button
                  onClick={handleApprove}
                  disabled={savingDecision}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-2 disabled:cursor-wait disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingDecision ? 'Saving…' : 'Approve Decision'}</span>
                </button>
              </div>}
            </div>
            {decisionError && <p role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{decisionError}</p>}
          </div>
        </div>
      )}
    </div>
  );
};
