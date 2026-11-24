import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileSearch,
  FileText,
  History,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Search,
  Shield,
  UserCircle2,
  X,
  XCircle,
} from 'lucide-react';
import { ThemeSelector } from '../ThemeSelector';
import {
  decideEvaluationDemoReview,
  EvaluationDemoAsset,
  EvaluationDemoEvent,
  EvaluationDemoRequestError,
  EvaluationDemoReviewTask,
  getEvaluationDemoSessionStatus,
  listEvaluationDemoContent,
  listEvaluationDemoReviewTasks,
  restartEvaluationDemoSession,
  subscribeEvaluationDemoSessionStatus,
} from '../../services/evaluationDemoWorkspace';
import { decideOfficeReview, listOfficeReviewerWorkspace, OfficeFactVersion } from '../../services/officeWorkspace';
import { GuestClaimFinding, GuestEvidenceItem } from '../../services/guestVerification';
import { WorkspaceNotice } from '../WorkspaceNotice';

type ReviewerPage =
  | 'overview'
  | 'queue'
  | 'flagged'
  | 'evidence'
  | 'impact'
  | 'history'
  | 'fact-history'
  | 'audit'
  | 'notifications'
  | 'settings';

interface ReviewerWorkspaceProps {
  organizationLabel: string;
  onSwitchWorkspace: (workspace: 'admin' | 'creator' | 'reviewer') => void;
  onLogout?: () => void | Promise<void>;
  publicDemo?: boolean;
  canSwitchWorkspace?: boolean;
  availableOfficeRoles?: Array<'creator' | 'reviewer' | 'admin'>;
}

const navigation: Array<{ id: ReviewerPage; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={17} /> },
  { id: 'queue', label: 'Review Queue', icon: <ClipboardCheck size={17} /> },
  { id: 'flagged', label: 'Flagged Claims', icon: <AlertTriangle size={17} /> },
  { id: 'evidence', label: 'Evidence Explorer', icon: <FileSearch size={17} /> },
  { id: 'impact', label: 'Change Impact Alerts', icon: <RefreshCw size={17} /> },
  { id: 'history', label: 'Review History', icon: <History size={17} /> },
  { id: 'fact-history', label: 'Fact Version History', icon: <History size={17} /> },
  { id: 'audit', label: 'Audit Trail', icon: <FileText size={17} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={17} /> },
  { id: 'settings', label: 'Settings', icon: <Shield size={17} /> },
];

const titles: Record<ReviewerPage, string> = {
  overview: 'Review Overview',
  queue: 'Review Queue',
  flagged: 'Flagged Claims',
  evidence: 'Evidence Explorer',
  impact: 'Change Impact Alerts',
  history: 'Review History',
  'fact-history': 'Fact Version History',
  audit: 'Audit Trail',
  notifications: 'Notifications',
  settings: 'Settings',
};

const surface = 'rounded-xl border border-[var(--pl-border)] bg-[var(--pl-surface)]';

const dateLabel = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const statusClass = (status: string) => {
  if (status === 'supported' || status === 'approved') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (status === 'contradicted' || status === 'outdated' || status === 'rejected') return 'bg-rose-500/10 text-rose-700 dark:text-rose-300';
  if (status === 'in_review' || status === 'pending') return 'bg-blue-500/10 text-blue-700 dark:text-blue-300';
  if (status === 'unsupported' || status === 'inconclusive' || status === 'revision_requested') return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
  return 'bg-slate-500/10 text-slate-600 dark:text-slate-300';
};

const statusLabel = (status: string) => status.replaceAll('_', ' ');

const loadReviewerData = async (publicDemo: boolean) => {
  if (!publicDemo) {
    const workspace = await listOfficeReviewerWorkspace();
    return {
      assets: workspace.assets,
      events: workspace.events,
      tasks: workspace.tasks,
      factHistory: workspace.factHistory,
    };
  }
  const [workspace, reviewQueue] = await Promise.all([
    listEvaluationDemoContent(),
    listEvaluationDemoReviewTasks(),
  ]);
  return { assets: workspace.assets, events: workspace.events, tasks: reviewQueue.tasks, factHistory: [] };
};

export const ReviewerWorkspace: React.FC<ReviewerWorkspaceProps> = ({
  organizationLabel,
  onSwitchWorkspace,
  onLogout,
  publicDemo = true,
  canSwitchWorkspace = false,
  availableOfficeRoles = [],
}) => {
  const evaluationSessionStatus = useSyncExternalStore(
    subscribeEvaluationDemoSessionStatus,
    getEvaluationDemoSessionStatus,
    getEvaluationDemoSessionStatus,
  );
  const [page, setPage] = useState<ReviewerPage>('overview');
  const [assets, setAssets] = useState<EvaluationDemoAsset[]>([]);
  const [tasks, setTasks] = useState<EvaluationDemoReviewTask[]>([]);
  const [events, setEvents] = useState<EvaluationDemoEvent[]>([]);
  const [factHistory, setFactHistory] = useState<OfficeFactVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTask, setSelectedTask] = useState<EvaluationDemoReviewTask | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const [savingDecision, setSavingDecision] = useState(false);
  const [restartingDemo, setRestartingDemo] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await loadReviewerData(publicDemo);
      setAssets(data.assets);
      setEvents(data.events);
      setTasks(data.tasks);
      setFactHistory(data.factHistory);
    } catch (cause) {
      setError(publicDemo
        ? cause instanceof EvaluationDemoRequestError ? cause.message : 'Could not load the Reviewer workspace. Try again.'
        : cause instanceof Error ? cause.message : 'Could not load the Reviewer workspace.');
    } finally {
      setLoading(false);
    }
  }, [publicDemo]);

  useEffect(() => {
    let active = true;
    void loadReviewerData(publicDemo)
      .then((data) => {
        if (!active) return;
        setAssets(data.assets);
        setEvents(data.events);
        setTasks(data.tasks);
        setFactHistory(data.factHistory);
      })
      .catch((cause: unknown) => {
        if (active) setError(publicDemo
          ? cause instanceof EvaluationDemoRequestError ? cause.message : 'Could not load the Reviewer workspace. Try again.'
          : cause instanceof Error ? cause.message : 'Could not load the Reviewer workspace.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [publicDemo]);

  const restartDemo = async () => {
    if (restartingDemo) return;
    setRestartingDemo(true);
    setError('');
    try {
      await restartEvaluationDemoSession();
      setSelectedTask(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The demo could not be restarted. Try again.');
    } finally {
      setRestartingDemo(false);
    }
  };

  const assetsById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const allFindings = useMemo(
    () => assets.flatMap((asset) => (asset.assessment?.findings || []).map((finding) => ({ asset, finding }))),
    [assets],
  );
  const pendingTasks = tasks.filter((task) => task.status === 'pending');
  const approvedCount = assets.filter((asset) => asset.approval_status === 'approved').length;
  const revisionCount = assets.filter((asset) => asset.approval_status === 'revision_requested').length;
  const rejectedCount = assets.filter((asset) => asset.approval_status === 'rejected').length;
  const reassessmentCount = assets.filter((asset) => asset.approval_status === 'reassessment_required').length;
  const highRiskCount = allFindings.filter(({ finding }) =>
    finding.status === 'contradicted',
  ).length;

  const changePage = (nextPage: ReviewerPage) => {
    setPage(nextPage);
    setMobileOpen(false);
    setError('');
  };

  const openReview = (task: EvaluationDemoReviewTask) => {
    setSelectedTask(task);
    setSelectedClaimId(assetsById.get(task.assetId)?.assessment?.findings[0]?.claim_id || '');
    setReviewNote('');
    setDecisionError('');
  };

  const selectedAsset = selectedTask ? assetsById.get(selectedTask.assetId) : undefined;
  const selectedFinding = selectedAsset?.assessment?.findings.find((finding) => finding.claim_id === selectedClaimId);
  const approvalBlocked = Boolean(
    selectedAsset?.approval_status === 'reassessment_required'
    || selectedAsset?.assessment?.findings.some((finding) => finding.status === 'contradicted'),
  );

  const decide = async (decision: 'approve' | 'reject' | 'request_revision') => {
    if (!selectedTask || savingDecision) return;
    if (decision !== 'approve' && !reviewNote.trim()) {
      setDecisionError('Add a reviewer explanation before rejecting or requesting revisions.');
      return;
    }
    if (decision === 'approve' && approvalBlocked) {
      setDecisionError('Approval is blocked while contradicted or outdated claims remain unresolved.');
      return;
    }
    const action = decision === 'approve' ? 'approve' : decision === 'reject' ? 'reject' : 'request revisions';
    if (!window.confirm(`Confirm ${action} for ${selectedTask.assetTitle}, version ${selectedTask.contentVersion}?`)) return;

    setSavingDecision(true);
    setDecisionError('');
    try {
      if (publicDemo) {
        await decideEvaluationDemoReview(selectedTask.id, decision, reviewNote.trim());
      } else {
        await decideOfficeReview(selectedTask.id, decision, reviewNote.trim());
      }
      setSelectedTask(null);
      await refresh();
    } catch (cause) {
      setDecisionError(publicDemo
        ? cause instanceof EvaluationDemoRequestError ? cause.message : 'The review decision could not be saved. Try again.'
        : cause instanceof Error ? cause.message : 'The review decision could not be saved.');
    } finally {
      setSavingDecision(false);
    }
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = `${task.id} ${task.assetTitle} ${task.originalText}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const overview = (
    <div className="space-y-5">
      <PageIntro title="Review Overview" description="Manage content reviews, evidence checks and compliance decisions." />
      <section aria-label="Review key performance indicators" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { label: 'Pending Reviews', value: pendingTasks.length, icon: <Clock3 size={17} /> },
          { label: 'High-Risk Claims', value: highRiskCount, icon: <AlertTriangle size={17} /> },
          { label: 'Approved Content', value: approvedCount, icon: <CheckCircle2 size={17} /> },
          { label: 'Revisions Requested', value: revisionCount, icon: <RefreshCw size={17} /> },
          { label: 'Rejected Content', value: rejectedCount, icon: <XCircle size={17} /> },
          { label: 'Reassessment Required', value: reassessmentCount, icon: <Shield size={17} /> },
        ].map(({ label, value, icon }) => (
          <div key={String(label)} className={`${surface} p-4`}>
            <div className="flex items-center justify-between text-sm text-[var(--pl-muted)]">
              <span>{label}</span><span key={String(label)} className="text-blue-600">{icon}</span>
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
            <p className="mt-1 text-[10px] text-[var(--pl-muted)]">{publicDemo ? 'Fictional NovaWear demo data' : 'Organization-scoped workspace data'}</p>
          </div>
        ))}
      </section>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className={`${surface} p-4 sm:p-5`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Priority Review Queue</h2>
            <button type="button" onClick={() => changePage('queue')} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">View queue <ChevronRight size={14} /></button>
          </div>
          {pendingTasks.length ? <div className="divide-y divide-[var(--pl-border)]">
            {pendingTasks.slice(0, 5).map((task) => <button key={task.id} type="button" onClick={() => openReview(task)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
              <span className="min-w-0"><span className="block truncate text-sm font-medium">{task.assetTitle}</span><span className="mt-0.5 block text-xs text-[var(--pl-muted)]">{task.id} · Version {task.contentVersion}</span></span>
              <StatusBadge status={task.status} />
            </button>)}
          </div> : <EmptyState text="No submissions are waiting for review." />}
        </section>
        <section className={`${surface} p-4 sm:p-5`}>
          <h2 className="text-sm font-semibold">Pending Actions</h2>
          <ActionLine label="Review submissions" value={pendingTasks.length} onClick={() => changePage('queue')} />
          <ActionLine label="Inspect flagged claims" value={highRiskCount} onClick={() => changePage('flagged')} />
          <ActionLine label="Review reassessment alerts" value={reassessmentCount} onClick={() => changePage('impact')} />
        </section>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className={`${surface} p-4 sm:p-5`}>
          <h2 className="text-sm font-semibold">Recent Submissions</h2>
          {tasks.length ? <div className="mt-2 divide-y divide-[var(--pl-border)]">
            {tasks.slice(0, 4).map((task) => <div key={task.id} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0"><span className="block truncate text-sm font-medium">{task.assetTitle}</span><span className="text-xs text-[var(--pl-muted)]">Submitted {dateLabel(task.createdAt)}</span></span>
              <StatusBadge status={task.status === 'modified' ? 'revision_requested' : task.status} />
            </div>)}
          </div> : <EmptyState text="Creator submissions will appear here after they are submitted for review." />}
        </section>
        <section className={`${surface} p-4 sm:p-5`}>
          <h2 className="text-sm font-semibold">Recent Review Activity</h2>
          {events.length ? <div className="mt-2 divide-y divide-[var(--pl-border)]">
            {events.slice(0, 4).map((event) => <div key={event.id} className="py-3">
              <p className="text-sm font-medium">{event.title}</p>
              <p className="mt-0.5 text-xs text-[var(--pl-muted)]">{event.details}</p>
              <time className="mt-1 block text-[11px] text-[var(--pl-muted)]">{dateLabel(event.timestamp)}</time>
            </div>)}
          </div> : <EmptyState text="No workflow activity is recorded." />}
        </section>
      </div>
    </div>
  );

  const queueView = (
    <div className="space-y-4">
      <PageIntro title="Review Queue" description="Search submissions, inspect the submitted version and record a human decision." />
      <section className={`${surface} overflow-hidden`}>
        <div className="grid gap-3 border-b border-[var(--pl-border)] p-3 sm:grid-cols-[1fr_200px]">
          <label className="relative block"><Search size={15} className="absolute left-3 top-2.5 text-[var(--pl-muted)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-lg border border-[var(--pl-border)] bg-[var(--pl-input)] py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500" placeholder="Search title, submission ID or content" /></label>
          <select aria-label="Filter review status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-[var(--pl-border)] bg-[var(--pl-input)] px-3 py-2 text-sm">
            <option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="modified">Revision requested</option><option value="rejected">Rejected</option>
          </select>
        </div>
        {filteredTasks.length ? <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-[var(--pl-surface-raised)] text-xs text-[var(--pl-muted)]"><tr><th className="px-4 py-3">Submission ID</th><th className="px-4 py-3">Content</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Version</th><th className="px-4 py-3">Claims / flags</th><th className="px-4 py-3">Risk</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead>
            <tbody className="divide-y divide-[var(--pl-border)]">{filteredTasks.map((task) => {
              const asset = assetsById.get(task.assetId);
              const findings = asset?.assessment?.findings || [];
              const risky = findings.filter((finding) => finding.status === 'contradicted').length;
              return <tr key={task.id}>
                <td className="px-4 py-3 font-mono text-xs">{task.id}</td>
                <td className="max-w-56 px-4 py-3"><p className="truncate font-medium">{task.assetTitle}</p><p className="text-xs capitalize text-[var(--pl-muted)]">{asset?.input_method || 'text'} content</p></td>
                <td className="px-4 py-3 text-xs text-[var(--pl-muted)]">{dateLabel(task.createdAt)}</td>
                <td className="px-4 py-3">v{task.contentVersion}</td>
                <td className="px-4 py-3 tabular-nums">{findings.length} / {risky}</td>
                <td className="px-4 py-3"><StatusBadge status={risky ? 'high risk' : 'not flagged'} /></td>
                <td className="px-4 py-3"><StatusBadge status={task.status === 'modified' ? 'revision_requested' : task.status} /></td>
                <td className="px-4 py-3"><button type="button" onClick={() => openReview(task)} className="rounded-md border border-[var(--pl-border)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--pl-surface-raised)]">Inspect</button></td>
              </tr>;
            })}</tbody>
          </table>
        </div> : <EmptyState text={tasks.length ? 'No submissions match these filters.' : 'The review queue is empty. Submitted Creator content appears here.'} />}
      </section>
    </div>
  );

  const flaggedView = (
    <div className="space-y-4">
      <PageIntro title="Flagged Claims" description="Verification findings from submitted content. Unsupported means evidence was not found; it is not proof that a claim is false." />
      {allFindings.filter(({ finding }) => ['contradicted', 'unsupported', 'inconclusive'].includes(finding.status)).length ? (
        <section className={`${surface} divide-y divide-[var(--pl-border)]`}>
          {allFindings.filter(({ finding }) => ['contradicted', 'unsupported', 'inconclusive'].includes(finding.status)).map(({ asset, finding }) => <article key={`${asset.id}-${finding.claim_id}`} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-medium">{finding.original_claim}</p><p className="mt-1 text-xs text-[var(--pl-muted)]">{asset.title} · v{asset.version}</p></div><StatusBadge status={finding.status} /></div>
            <p className="mt-2 text-xs leading-5 text-[var(--pl-muted)]">{finding.explanation}</p>
            {finding.limitation && <p className="mt-2 text-xs text-[var(--pl-muted)]">{finding.limitation}</p>}
            {finding.suggested_correction && <p className="mt-2 text-xs"><strong>Suggested correction:</strong> {finding.suggested_correction}</p>}
          </article>)}
        </section>
      ) : <section className={`${surface} p-5`}><EmptyState text="No flagged findings are present in submitted content." /></section>}
    </div>
  );

  const evidenceItems = allFindings.flatMap(({ asset, finding }) =>
    finding.evidence.map((evidence) => ({ asset, finding, evidence })),
  );
  const evidenceView = (
    <div className="space-y-4">
      <PageIntro title="Evidence Explorer" description={publicDemo ? 'Read-only evidence returned with claim assessments. The demo does not supply evidence versions or effective dates.' : 'Read-only citations from evidence approved for this organization.'} />
      <label className="relative block"><Search size={15} className="absolute left-3 top-2.5 text-[var(--pl-muted)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-lg border border-[var(--pl-border)] bg-[var(--pl-input)] py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500" placeholder="Search sources, passages or claims" /></label>
      {evidenceItems.filter(({ asset, finding, evidence }) => `${asset.title} ${finding.original_claim} ${evidence.source_title} ${evidence.passage}`.toLowerCase().includes(search.toLowerCase())).length ? (
        <div className="grid gap-3">{evidenceItems.filter(({ asset, finding, evidence }) => `${asset.title} ${finding.original_claim} ${evidence.source_title} ${evidence.passage}`.toLowerCase().includes(search.toLowerCase())).map(({ asset, finding, evidence }) => <EvidenceCard key={`${asset.id}-${finding.claim_id}-${evidence.id}`} asset={asset} finding={finding} evidence={evidence} />)}</div>
      ) : <section className={`${surface} p-5`}><EmptyState text={evidenceItems.length ? 'No evidence matches your search.' : publicDemo ? 'No source evidence is attached to the available claim assessments. The demo does not fabricate citations.' : 'No approved evidence citations are attached to the available claim assessments.'} /></section>}
    </div>
  );

  const impactEvents = events.filter((event) => /impact|reassess|fact_changed|approval_invalidated/i.test(`${event.type} ${event.title}`));
  const impactView = (
    <div className="space-y-4">
      <PageIntro title="Change Impact Alerts" description={publicDemo ? 'Alerts are shown only when the shared demo workflow records a corresponding event.' : 'Organization-scoped reassessment alerts triggered by approved fact changes.'} />
      {impactEvents.length ? <section className={`${surface} divide-y divide-[var(--pl-border)]`}>{impactEvents.map((event) => <EventCard key={event.id} event={event} />)}</section> : <section className={`${surface} p-5`}><EmptyState text={publicDemo ? 'No change-impact or reassessment events are recorded for this session. Admin fact changes are not currently connected to the isolated demo review store.' : 'No change-impact or reassessment events are recorded for this organization.'} /></section>}
    </div>
  );

  const historyView = (
    <div className="space-y-4">
      <PageIntro title="Review History" description="Completed decisions remain available alongside their submission version and reviewer feedback." />
      {tasks.filter((task) => task.status !== 'pending').length ? <section className={`${surface} overflow-x-auto`}>
        <table className="w-full min-w-[740px] text-left text-sm"><thead className="bg-[var(--pl-surface-raised)] text-xs text-[var(--pl-muted)]"><tr><th className="px-4 py-3">Content / version</th><th className="px-4 py-3">Reviewer</th><th className="px-4 py-3">Decision</th><th className="px-4 py-3">Timestamp</th><th className="px-4 py-3">Feedback</th></tr></thead>
          <tbody className="divide-y divide-[var(--pl-border)]">{tasks.filter((task) => task.status !== 'pending').map((task) => <tr key={task.id}><td className="px-4 py-3"><p className="font-medium">{task.assetTitle}</p><p className="text-xs text-[var(--pl-muted)]">{task.id} · v{task.contentVersion}</p></td><td className="px-4 py-3">{task.reviewedBy || '—'}</td><td className="px-4 py-3"><StatusBadge status={task.status === 'modified' ? 'revision_requested' : task.status} /></td><td className="px-4 py-3 text-xs text-[var(--pl-muted)]">{dateLabel(task.reviewedAt)}</td><td className="max-w-72 px-4 py-3 text-xs text-[var(--pl-muted)]">{task.notes || '—'}</td></tr>)}</tbody>
        </table>
      </section> : <section className={`${surface} p-5`}><EmptyState text="Completed review decisions will appear here." /></section>}
    </div>
  );

  const factHistoryView = (
    <div className="space-y-4">
      <PageIntro title="Fact Version History" description="Historical approved fact values retained for review and audit." />
      {factHistory.length ? <section className={`${surface} divide-y divide-[var(--pl-border)]`}>
        {factHistory.map((entry, index) => <article key={`${entry.fact.id}-${entry.fact.version}-${entry.recorded_at}-${index}`} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h3 className="text-sm font-semibold">{entry.fact.name}</h3><p className="mt-1 text-xs text-[var(--pl-muted)]">{entry.fact.id} · Version {entry.fact.version}</p></div>
            <time className="text-xs text-[var(--pl-muted)]">{dateLabel(entry.recorded_at)}</time>
          </div>
          <p className="mt-3 text-sm">{entry.fact.current_value}</p>
          <p className="mt-1 text-xs text-[var(--pl-muted)]">{entry.fact.source_document_title || 'No source document'} · Recorded by {entry.recorded_by}</p>
          <p className="mt-2 text-xs leading-5 text-[var(--pl-muted)]">{entry.fact.source_passage}</p>
        </article>)}
      </section> : <section className={`${surface} p-5`}><EmptyState text="No fact versions have been recorded for this organization." /></section>}
    </div>
  );

  const auditView = (
    <div className="space-y-4">
      <PageIntro title="Audit Trail" description={publicDemo ? 'Session events are returned by the demo backend and cannot be edited from this workspace.' : 'Organization-scoped audit events for review and reassessment actions.'} />
      {events.length ? <section className={`${surface} divide-y divide-[var(--pl-border)]`}>{events.map((event) => <EventCard key={event.id} event={event} />)}</section> : <section className={`${surface} p-5`}><EmptyState text="No audit events have been recorded." /></section>}
    </div>
  );

  const notificationsView = (
    <div className="space-y-4">
      <PageIntro title="Notifications" description="Workflow notifications are sourced from recorded workspace events; real-time delivery and read states are not enabled." />
      {events.length ? <section className={`${surface} divide-y divide-[var(--pl-border)]`}>{events.map((event) => <EventCard key={event.id} event={event} />)}</section> : <section className={`${surface} p-5`}><EmptyState text="No workflow notifications are available." /></section>}
    </div>
  );

  const settingsView = (
    <div className="space-y-4">
      <PageIntro title="Settings" description="Reviewer workspace preferences." />
      <section className={`${surface} max-w-2xl space-y-4 p-4 sm:p-5`}>
        <div><h2 className="text-sm font-semibold">Appearance</h2><p className="mt-1 text-xs text-[var(--pl-muted)]">Choose Minimal Professional or Dark Enterprise.</p><div className="mt-3"><ThemeSelector /></div></div>
        <div className="border-t border-[var(--pl-border)] pt-4"><h2 className="text-sm font-semibold">Workspace</h2><p className="mt-1 text-sm">{organizationLabel}</p><p className="mt-1 text-xs text-[var(--pl-muted)]">{publicDemo ? 'Fictional evaluation data isolated to this anonymous server session.' : 'Office data is isolated to the authenticated organization.'}</p></div>
      </section>
    </div>
  );

  const content = {
    overview,
    queue: queueView,
    flagged: flaggedView,
    evidence: evidenceView,
    impact: impactView,
    history: historyView,
    'fact-history': factHistoryView,
    audit: auditView,
    notifications: notificationsView,
    settings: settingsView,
  }[page];

  return (
    <div className="flex min-h-screen bg-[var(--pl-app-bg)] text-[var(--pl-text)]">
      {mobileOpen && <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-black/40 md:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--pl-border)] bg-[var(--pl-sidebar)] transition-transform md:static md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[68px] items-center justify-between border-b border-[var(--pl-border)] px-5">
          <div><p className="text-sm font-semibold tracking-tight">ProofLine</p><p className="text-[11px] text-[var(--pl-muted)]">Reviewer workspace</p></div>
          <button type="button" className="rounded-md p-2 text-[var(--pl-muted)] md:hidden" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={17} /></button>
        </div>
        <nav aria-label="Reviewer navigation" className="flex-1 space-y-1 overflow-y-auto p-3">
          {navigation.map((item) => <button key={item.id} type="button" onClick={() => changePage(item.id)} className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm ${page === item.id ? 'bg-blue-600/10 font-medium text-blue-700 dark:text-blue-300' : 'text-[var(--pl-muted)] hover:bg-[var(--pl-surface-raised)] hover:text-[var(--pl-text)]'}`}>
            <span className="shrink-0">{item.icon}</span><span>{item.label}</span>
            {item.id === 'queue' && pendingTasks.length > 0 && <span className="ml-auto rounded-full bg-blue-600 px-2 py-0.5 text-[10px] text-white">{pendingTasks.length}</span>}
          </button>)}
        </nav>
        <div className="border-t border-[var(--pl-border)] p-3"><div className="rounded-lg bg-[var(--pl-surface-raised)] p-3"><p className="text-xs font-medium">{publicDemo ? 'Demo session' : 'Office workspace'}</p><p className="mt-1 text-[10px] leading-4 text-[var(--pl-muted)]">{publicDemo ? 'Fictional data · session isolated' : 'Organization-scoped data'}</p></div></div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b border-[var(--pl-border)] bg-[var(--pl-surface)] px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="rounded-md p-2 text-[var(--pl-muted)] md:hidden"><Menu size={19} /></button>
            <div className="min-w-0"><h1 className="truncate text-sm font-semibold sm:text-base">{titles[page]}</h1><p className="truncate text-xs text-[var(--pl-muted)]">{organizationLabel}{publicDemo ? ' · Fictional demo' : ' · Office Workspace'}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => changePage('notifications')} aria-label="Open notifications" className="relative rounded-lg border border-[var(--pl-border)] p-2 text-[var(--pl-muted)]"><Bell size={17} />{events.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] text-white">{Math.min(events.length, 99)}</span>}</button>
            <ThemeSelector compact />
            <span className="hidden items-center gap-1.5 rounded-lg border border-[var(--pl-border)] px-2.5 py-2 text-xs font-medium sm:inline-flex"><Shield size={14} className="text-blue-600" /> Reviewer</span>
            {(publicDemo || canSwitchWorkspace) && <label className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--pl-border)] px-2.5 py-2 text-xs font-medium">
              <span className="hidden sm:inline">Switch Workspace</span>
              <select aria-label={publicDemo ? 'Switch Evaluation workspace' : 'Switch authorized Office workspace'} value="reviewer" onChange={(event) => onSwitchWorkspace(event.target.value as 'admin' | 'creator' | 'reviewer')} className="max-w-36 cursor-pointer bg-transparent text-xs outline-none">{(publicDemo ? ['admin', 'creator', 'reviewer'] : availableOfficeRoles).map((role) => <option key={role} value={role}>{role === 'creator' ? 'Content Creator' : role === 'admin' ? 'Admin' : 'Reviewer'}</option>)}</select>
            </label>}
            <div className="relative">
              <button type="button" aria-expanded={profileOpen} aria-label="Open profile menu" onClick={() => setProfileOpen((open) => !open)} className="rounded-lg border border-[var(--pl-border)] p-2 text-[var(--pl-muted)]"><UserCircle2 size={17} /></button>
              {profileOpen && <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-48 rounded-lg border border-[var(--pl-border)] bg-[var(--pl-surface)] p-2 shadow-lg"><p className="px-2 py-2 text-xs text-[var(--pl-muted)]">{publicDemo ? 'Anonymous Evaluation session' : 'Authenticated Office session'}</p>{onLogout && <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); void onLogout(); }} className="w-full rounded-md px-2 py-2 text-left text-sm hover:bg-[var(--pl-surface-raised)]">Sign out</button>}</div>}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] space-y-4 p-4 sm:p-6 lg:p-8">
          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-3 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"><Shield size={15} className="mt-0.5 shrink-0" /><p>{publicDemo ? 'Evaluation Access · fictional NovaWear content and reviewer decisions are persisted in this isolated demo session. AI verification is advisory; the final decision is yours.' : 'Office Workspace · review records and evidence are scoped to your authorized organization. AI verification is advisory; the final decision is yours.'}</p></div>
          {publicDemo && evaluationSessionStatus === 'restoring' && <WorkspaceNotice tone="info">Restoring the Evaluation demo session…</WorkspaceNotice>}
          {publicDemo && evaluationSessionStatus === 'expired' && <WorkspaceNotice
            tone="warning"
            action={<button type="button" disabled={restartingDemo} onClick={() => void restartDemo()} className="font-semibold underline disabled:opacity-60">{restartingDemo ? 'Restarting…' : 'Restart Demo'}</button>}
          >
            <p>This demo session could not be recovered. Restarting starts a new session; previous demo changes may be lost.</p>
            {error && <p className="mt-1">{error}</p>}
          </WorkspaceNotice>}
          {error && !(publicDemo && evaluationSessionStatus === 'expired') && <WorkspaceNotice
            tone="warning"
            action={<button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-1 font-semibold underline"><RefreshCw size={14} /> Retry</button>}
          >
            {error}
          </WorkspaceNotice>}
          {loading ? <div className={`${surface} p-8 text-center text-sm text-[var(--pl-muted)]`}><RefreshCw className="mx-auto mb-2 animate-spin" size={18} />{publicDemo && evaluationSessionStatus === 'restoring' ? 'Restoring Evaluation demo session…' : 'Loading reviewer workspace…'}</div> : content}
        </main>
      </div>
      {selectedTask && <ReviewInspector
        task={selectedTask}
        asset={selectedAsset}
        selectedFinding={selectedFinding}
        selectedClaimId={selectedClaimId}
        note={reviewNote}
        error={decisionError}
        saving={savingDecision}
        approvalBlocked={approvalBlocked}
        publicDemo={publicDemo}
        onClose={() => { if (!savingDecision) setSelectedTask(null); }}
        onSelectClaim={setSelectedClaimId}
        onNoteChange={setReviewNote}
        onDecision={(decision) => void decide(decision)}
      />}
    </div>
  );
};

function PageIntro({ title, description }: { title: string; description: string }) {
  return <header><h2 className="text-xl font-semibold tracking-tight">{title}</h2><p className="mt-1 text-sm text-[var(--pl-muted)]">{description}</p></header>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${statusClass(status)}`}>{statusLabel(status)}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-5 text-sm text-[var(--pl-muted)]">{text}</p>;
}

function ActionLine({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="mt-3 flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--pl-border)] px-3 py-2.5 text-left hover:bg-[var(--pl-surface-raised)]"><span className="text-sm">{label}</span><span className="flex items-center gap-2 text-xs text-[var(--pl-muted)]">{value}<ChevronRight size={14} /></span></button>;
}

function EventCard({ event }: { event: EvaluationDemoEvent }) {
  return <article className="p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">{event.title}</h3><time className="text-xs text-[var(--pl-muted)]">{dateLabel(event.timestamp)}</time></div>
    <p className="mt-1 text-xs leading-5 text-[var(--pl-muted)]">{event.details}</p>
    <p className="mt-2 text-[10px] text-[var(--pl-muted)]">{event.actor || 'Evaluation System'} · {event.role || 'system'}{event.resource_id ? ` · ${event.resource_id}` : ''}{event.version ? ` · v${event.version}` : ''}</p>
  </article>;
}

function EvidenceCard({ asset, finding, evidence }: { asset: EvaluationDemoAsset; finding: GuestClaimFinding; evidence: GuestEvidenceItem }) {
  return <article className={`${surface} p-4`}>
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-semibold">{evidence.source_title}</h3><p className="mt-1 text-xs text-[var(--pl-muted)]">{asset.title} · claim: {finding.original_claim}</p></div><StatusBadge status={finding.status} /></div>
    <blockquote className="mt-3 border-l-2 border-blue-500 pl-3 text-sm leading-6">{evidence.passage}</blockquote>
    <p className="mt-2 text-[11px] text-[var(--pl-muted)]">{evidence.source_type === 'demonstration' ? 'Fictional demo evidence' : evidence.source_type === 'office_approved' ? 'Organization-approved evidence' : 'Creator-provided reference'} · Evidence version and effective date are not provided by the source.</p>
    {evidence.source_url && <a className="mt-2 inline-block text-xs text-blue-600 underline" href={evidence.source_url} target="_blank" rel="noreferrer">Open source</a>}
  </article>;
}

function ReviewInspector({
  task,
  asset,
  selectedFinding,
  selectedClaimId,
  note,
  error,
  saving,
  approvalBlocked,
  publicDemo,
  onClose,
  onSelectClaim,
  onNoteChange,
  onDecision,
}: {
  task: EvaluationDemoReviewTask;
  asset?: EvaluationDemoAsset;
  selectedFinding?: GuestClaimFinding;
  selectedClaimId: string;
  note: string;
  error: string;
  saving: boolean;
  approvalBlocked: boolean;
  publicDemo: boolean;
  onClose: () => void;
  onSelectClaim: (claimId: string) => void;
  onNoteChange: (value: string) => void;
  onDecision: (decision: 'approve' | 'reject' | 'request_revision') => void;
}) {
  const findings = asset?.assessment?.findings || [];
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="review-dialog-title" className="flex max-h-[96vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-xl border border-[var(--pl-border)] bg-[var(--pl-app-bg)] shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-[var(--pl-border)] bg-[var(--pl-surface)] px-4 py-3 sm:px-5">
        <div className="min-w-0"><p className="text-[11px] font-medium uppercase tracking-wide text-blue-600">Submission {task.id} · Version {task.contentVersion}</p><h2 id="review-dialog-title" className="mt-1 truncate text-base font-semibold">{task.assetTitle}</h2><p className="mt-1 text-xs text-[var(--pl-muted)]">Submitted {dateLabel(task.createdAt)} · {publicDemo ? 'Assigned reviewer: Evaluation Reviewer' : 'Organization-scoped Office review'}</p></div>
        <button type="button" aria-label="Close review" onClick={onClose} className="rounded-md p-2 text-[var(--pl-muted)] hover:bg-[var(--pl-surface-raised)]"><X size={18} /></button>
      </header>
      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] sm:p-4">
        <section className={`${surface} min-w-0 p-4`}>
          <h3 className="text-sm font-semibold">Submitted content</h3>
          <p className="mt-1 text-xs text-[var(--pl-muted)]">{asset?.input_method === 'pdf' ? 'Text extracted from submitted PDF' : asset?.input_method === 'image' ? 'Text extracted from submitted image' : 'Original submitted text'} · v{task.contentVersion}</p>
          <div className="mt-3 max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-[var(--pl-border)] bg-[var(--pl-surface-raised)] p-3 text-sm leading-6">{asset?.source_text || task.originalText || 'No text preview was supplied for this submission.'}</div>
          <p className="mt-3 text-xs text-[var(--pl-muted)]">{asset?.product.name || asset?.product.brand ? `${asset.product.name || ''}${asset.product.name && asset.product.brand ? ' · ' : ''}${asset.product.brand || ''}` : 'Product details not supplied'}</p>
        </section>
        <section className={`${surface} min-w-0 p-4`}>
          <h3 className="text-sm font-semibold">Extracted claims</h3>
          <p className="mt-1 text-xs text-[var(--pl-muted)]">Verification results are advisory and do not replace reviewer judgment.</p>
          {findings.length ? <div className="mt-3 space-y-2">
            {findings.map((finding) => <button key={finding.claim_id} type="button" onClick={() => onSelectClaim(finding.claim_id)} className={`w-full rounded-lg border p-3 text-left ${selectedClaimId === finding.claim_id ? 'border-blue-500 bg-blue-500/5' : 'border-[var(--pl-border)] hover:bg-[var(--pl-surface-raised)]'}`}>
              <span className="flex items-start justify-between gap-2"><span className="text-sm font-medium">{finding.original_claim}</span><StatusBadge status={finding.status} /></span>
              <span className="mt-1 block text-xs text-[var(--pl-muted)]">{statusLabel(finding.claim_type)} · {finding.explanation}</span>
            </button>)}
          </div> : <div className="mt-3 rounded-lg border border-amber-300 bg-amber-500/5 p-3 text-xs text-[var(--pl-muted)]">No claim assessment is available for this submission. Do not infer verification results.</div>}
        </section>
        <section className={`${surface} min-w-0 p-4`}>
          <h3 className="text-sm font-semibold">Evidence and explanation</h3>
          {selectedFinding ? <div className="mt-3 space-y-3">
            <div><StatusBadge status={selectedFinding.status} /><p className="mt-2 text-sm leading-5">{selectedFinding.explanation}</p></div>
            {selectedFinding.evidence.length ? selectedFinding.evidence.map((evidence) => <article key={evidence.id} className="rounded-lg border border-[var(--pl-border)] bg-[var(--pl-surface-raised)] p-3">
              <p className="text-xs font-semibold">{evidence.source_title}</p><p className="mt-2 text-xs leading-5">{evidence.passage}</p>
              <p className="mt-2 text-[10px] text-[var(--pl-muted)]">{evidence.source_type === 'demonstration' ? 'Fictional demo evidence' : evidence.source_type === 'office_approved' ? 'Organization-approved evidence' : 'Creator-provided reference'} · Version not supplied</p>
            </article>) : <p className="rounded-lg border border-amber-300 bg-amber-500/5 p-3 text-xs text-[var(--pl-muted)]">No approved evidence was returned for this claim. This limitation does not establish that the claim is false.</p>}
            {selectedFinding.suggested_correction && <p className="text-xs"><strong>Suggested correction:</strong> {selectedFinding.suggested_correction}</p>}
            {selectedFinding.limitation && <p className="text-xs text-[var(--pl-muted)]">{selectedFinding.limitation}</p>}
          </div> : <p className="mt-3 text-sm text-[var(--pl-muted)]">Select a claim to inspect its available evidence.</p>}
          {!findings.length && asset?.assessment?.evidence_source_note && <p className="mt-3 text-xs text-[var(--pl-muted)]">{asset.assessment.evidence_source_note}</p>}
        </section>
      </div>
      <footer className="border-t border-[var(--pl-border)] bg-[var(--pl-surface)] p-3 sm:p-4">
        {task.status === 'pending' ? <>
          <label className="block text-xs font-medium">Reviewer note <span className="font-normal text-[var(--pl-muted)]">(required for rejection or revision request)</span><textarea value={note} onChange={(event) => onNoteChange(event.target.value)} maxLength={1000} rows={2} className="mt-1.5 w-full resize-y rounded-lg border border-[var(--pl-border)] bg-[var(--pl-input)] px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="Record the reason for your decision." /></label>
          {approvalBlocked && <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">Approval is blocked while contradicted or outdated findings remain unresolved. No override is available.</p>}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-[var(--pl-muted)]">The decision applies to the submitted version and is persisted to {publicDemo ? 'this session' : 'the organization review history'}.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={saving} onClick={() => onDecision('reject')} className="rounded-lg border border-rose-500/30 px-3 py-2 text-xs font-medium text-rose-700 disabled:opacity-50 dark:text-rose-300">{saving ? 'Saving…' : 'Reject'}</button>
              <button type="button" disabled={saving} onClick={() => onDecision('request_revision')} className="rounded-lg border border-amber-500/30 px-3 py-2 text-xs font-medium text-amber-700 disabled:opacity-50 dark:text-amber-300">{saving ? 'Saving…' : 'Request revision'}</button>
              <button type="button" disabled={saving || approvalBlocked} onClick={() => onDecision('approve')} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving…' : 'Approve content'}</button>
            </div>
          </div>
        </> : <p className="text-sm text-[var(--pl-muted)]">This review task is already decided: {statusLabel(task.status)}. Historical decisions cannot be changed here.</p>}
        {error && <WorkspaceNotice tone="warning" className="mt-3">{error}</WorkspaceNotice>}
      </footer>
    </section>
  </div>;
}
