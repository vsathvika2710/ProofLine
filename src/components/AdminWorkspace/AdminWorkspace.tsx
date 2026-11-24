import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  ClipboardCheck,
  Database,
  FileCheck2,
  FileText,
  Gauge,
  History,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { ThemeSelector } from '../ThemeSelector';
import { Fact, EvidenceDocument, ContentAsset, ReviewTask, AuditLogEntry, ChangeImpactResult, UserRole } from '../../types';
import { FactList } from '../EvidenceVault/FactList';
import { ImpactDashboard } from '../ChangeImpact/ImpactDashboard';
import { ReviewQueue } from '../ReviewCenter/ReviewQueue';
import { MetricsOverview } from '../GovernanceAnalytics/MetricsOverview';
import { ContentScanner } from '../ContentReviewer/ContentScanner';
import { ScenarioDataset } from '../../types';

type AdminPage = 'overview' | 'evidence' | 'impact' | 'assets' | 'reviews' | 'analytics' | 'audit' | 'team' | 'settings';
type DemoWorkspace = 'creator' | 'reviewer' | 'admin';

interface AdminWorkspaceProps {
  publicDemo: boolean;
  organizationLabel: string;
  scenario: ScenarioDataset;
  facts: Fact[];
  documents: EvidenceDocument[];
  assets: ContentAsset[];
  tasks: ReviewTask[];
  auditLogs: AuditLogEntry[];
  activeRole: UserRole;
  canSwitchWorkspace?: boolean;
  availableOfficeRoles?: Array<'creator' | 'reviewer' | 'admin'>;
  canManageOfficeData?: boolean;
  error?: string;
  onFactUpdated: (fact: Fact, impact: ChangeImpactResult) => void | ChangeImpactResult | Promise<void | ChangeImpactResult>;
  onAddFact: (fact: Fact) => void;
  onCreateTask: (task: Partial<ReviewTask>) => void;
  onUpdateTask: (task: ReviewTask, log: AuditLogEntry) => void;
  onSwitchWorkspace: (workspace: DemoWorkspace) => void;
}

const navigation: Array<{ id: AdminPage; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={17} /> },
  { id: 'evidence', label: 'Evidence Vault', icon: <Database size={17} /> },
  { id: 'impact', label: 'Change Impact Engine', icon: <Zap size={17} /> },
  { id: 'assets', label: 'Content Assets', icon: <FileText size={17} /> },
  { id: 'reviews', label: 'Review Queue', icon: <ClipboardCheck size={17} /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={17} /> },
  { id: 'audit', label: 'Audit Ledger', icon: <History size={17} /> },
  { id: 'team', label: 'Team & Roles', icon: <Users size={17} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={17} /> },
];

const pageTitles: Record<AdminPage, string> = {
  overview: 'Governance Overview',
  evidence: 'Evidence Vault',
  impact: 'Change Impact Engine',
  assets: 'Content Assets',
  reviews: 'Review Queue',
  analytics: 'Governance Analytics',
  audit: 'Audit Ledger',
  team: 'Team & Roles',
  settings: 'Settings',
};

const surface = 'rounded-xl border border-[var(--pl-border)] bg-[var(--pl-surface)]';

export const AdminWorkspace: React.FC<AdminWorkspaceProps> = ({
  publicDemo,
  organizationLabel,
  scenario,
  facts,
  documents,
  assets,
  tasks,
  auditLogs,
  activeRole,
  canSwitchWorkspace = false,
  availableOfficeRoles = [],
  canManageOfficeData = false,
  error = '',
  onFactUpdated,
  onAddFact,
  onCreateTask,
  onUpdateTask,
  onSwitchWorkspace,
}) => {
  const [page, setPage] = useState<AdminPage>('overview');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openScanner, setOpenScanner] = useState(false);
  const pendingReviews = tasks.filter((task) => task.status === 'pending');
  const impactedAssets = assets.filter((asset) => asset.status === 'approval_invalidated');
  const openAlerts = assets.filter((asset) => asset.issuesCount > 0);
  const outdatedContent = impactedAssets;
  const evidenceNeedsUpdate = documents.filter((document) => document.status !== 'valid');
  const approvedFacts = facts.filter((fact) => fact.status === 'active');
  const dataSourceLabel = publicDemo
    ? 'Fictional NovaWear Demo data · browser-local and resets on reload'
    : 'Organization-scoped records loaded from the authenticated Office API';

  const changePage = (nextPage: AdminPage) => {
    setPage(nextPage);
    setMobileOpen(false);
    setOpenScanner(false);
  };

  const kpis = [
    { label: 'Approved Facts', value: approvedFacts.length, icon: <Shield size={17} />, tone: 'text-emerald-600' },
    { label: 'Pending Reviews', value: pendingReviews.length, icon: <ClipboardCheck size={17} />, tone: 'text-blue-600' },
    { label: 'Impacted Assets', value: impactedAssets.length, icon: <Zap size={17} />, tone: 'text-amber-600' },
    { label: 'Open Alerts', value: openAlerts.length, icon: <AlertTriangle size={17} />, tone: 'text-rose-600' },
  ];

  const overview = (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Governance Overview</h1>
        <p className="mt-1 text-sm text-[var(--pl-muted)]">Monitor evidence, content compliance and review activity.</p>
        <p className="mt-2 text-xs text-[var(--pl-muted)]">{dataSourceLabel}</p>
      </header>

      <section aria-label="Governance key performance indicators" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <div key={item.label} className={`${surface} p-4`}>
            <div className="flex items-center justify-between text-sm text-[var(--pl-muted)]">
              <span>{item.label}</span>
              <span className={item.tone}>{item.icon}</span>
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{item.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className={`${surface} p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent Governance Activity</h2>
            <button type="button" onClick={() => changePage('audit')} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
              Audit ledger <ArrowRight size={14} />
            </button>
          </div>
          {auditLogs.length ? (
            <div className="divide-y divide-[var(--pl-border)]">
              {auditLogs.slice(0, 5).map((entry) => (
                <div key={entry.id} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{entry.action.replaceAll('_', ' ')}</p>
                    <p className="mt-0.5 truncate text-xs text-[var(--pl-muted)]">{entry.target} · {entry.actor}</p>
                  </div>
                  <time className="text-xs text-[var(--pl-muted)]">{entry.timestamp}</time>
                </div>
              ))}
            </div>
          ) : <p className="py-6 text-sm text-[var(--pl-muted)]">No governance events are available.</p>}
        </section>

        <section className={`${surface} p-5`}>
          <h2 className="text-sm font-semibold">Pending Actions</h2>
          <div className="mt-4 space-y-3">
            <PendingItem title="Reviews awaiting attention" count={pendingReviews.length} onClick={() => changePage('reviews')} />
            <PendingItem title="Impacted or outdated content" count={outdatedContent.length} onClick={() => changePage('assets')} />
            <PendingItem title="Evidence requiring updates" count={evidenceNeedsUpdate.length} onClick={() => changePage('evidence')} />
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <section className={`${surface} p-5`}>
          <h2 className="text-sm font-semibold">Governance Health</h2>
          <p className="mt-1 text-xs text-[var(--pl-muted)]">Claim-level status breakdown is not present in the dashboard data model.</p>
          <div className="mt-4 space-y-3">
            {[
              ['Supported claims', 'Open Scanner for claim findings'],
              ['Contradicted claims', 'Not aggregated'],
              ['Unsupported claims', 'Not aggregated'],
              ['Inconclusive claims', 'Not aggregated'],
            ].map(([label, detail]) => (
              <div key={label} className="flex items-center justify-between gap-3 border-b border-[var(--pl-border)] pb-2 last:border-0">
                <span className="text-sm">{label}</span>
                <span className="text-right text-xs text-[var(--pl-muted)]">{detail}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={`${surface} p-5`}>
          <h2 className="text-sm font-semibold">Quick Actions</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <QuickAction
              icon={<Shield size={16} />}
              label="Add Approved Fact"
              onClick={() => changePage('evidence')}
              disabled={!publicDemo && !canManageOfficeData}
              note={!publicDemo && !canManageOfficeData ? 'Fact changes are not available for this account.' : undefined}
            />
            <QuickAction icon={<FileCheck2 size={16} />} label="Upload Evidence" disabled note="Evidence upload is not connected in this dashboard." />
            <QuickAction icon={<Zap size={16} />} label="Run Change Impact" onClick={() => changePage('impact')} />
            <QuickAction icon={<ClipboardCheck size={16} />} label="View Review Queue" onClick={() => changePage('reviews')} />
          </div>
        </section>
      </div>
    </div>
  );

  const assetList = (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Content Assets</h1>
          <p className="mt-1 text-sm text-[var(--pl-muted)]">Review submission status, assigned reviewers and flagged content.</p>
        </div>
        <button type="button" onClick={() => setOpenScanner(true)} disabled={!publicDemo} title={!publicDemo ? 'Content submissions are not persisted to organization records.' : undefined} className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
          Scan or submit content
        </button>
      </header>
      {openScanner ? (
        <section className={surface + ' p-4 sm:p-5'}>
          <button type="button" onClick={() => setOpenScanner(false)} className="mb-4 text-sm font-medium text-blue-600 hover:text-blue-700">← Back to assets</button>
          <ContentScanner scenario={scenario} facts={facts} onCreateReviewTask={onCreateTask} onNavigateToReviews={() => changePage('reviews')} />
        </section>
      ) : (
        <section className={`${surface} overflow-hidden`}>
          {assets.length ? <div className="overflow-x-auto">
            <table className="w-full min-w-[740px] text-left text-sm">
              <thead className="border-b border-[var(--pl-border)] bg-[var(--pl-surface-raised)] text-xs font-semibold text-[var(--pl-muted)]">
                <tr><th className="px-4 py-3">Asset</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Claims / flags</th><th className="px-4 py-3">Assigned reviewer</th><th className="px-4 py-3">Last scanned</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--pl-border)]">
                {assets.map((asset) => (
                  <tr key={asset.id}>
                    <td className="px-4 py-3"><p className="font-medium">{asset.title}</p><p className="mt-0.5 text-xs text-[var(--pl-muted)]">{asset.channel}</p></td>
                    <td className="px-4 py-3"><StatusBadge status={asset.status.replace('_', ' ')} /></td>
                    <td className="px-4 py-3 tabular-nums">{asset.claimsCount} / {asset.issuesCount}</td>
                    <td className="px-4 py-3 text-[var(--pl-muted)]">{asset.assignedReviewer || 'Unassigned'}</td>
                    <td className="px-4 py-3 text-xs text-[var(--pl-muted)]">{asset.lastScanned || 'Not scanned'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div> : <EmptyState title="No content assets" detail="Assets will appear here after they are added to this workspace." />}
        </section>
      )}
    </div>
  );

  const content = (() => {
    switch (page) {
      case 'overview': return overview;
      case 'evidence': return <FactList facts={facts} documents={documents} onSelectFactForImpact={() => changePage('impact')} onAddNewFact={onAddFact} readOnly={!publicDemo && !canManageOfficeData} />;
      case 'impact': return <ImpactDashboard facts={facts} assets={assets} onFactUpdated={onFactUpdated} onNavigateToReviews={() => changePage('reviews')} professionalMode allowCommit={publicDemo || canManageOfficeData} />;
      case 'assets': return assetList;
      case 'reviews': return <ReviewQueue tasks={tasks} auditLogs={auditLogs} activeRole={activeRole} onUpdateTask={onUpdateTask} readOnly={!publicDemo} professionalMode />;
      case 'analytics': return <MetricsOverview facts={facts} documents={documents} assets={assets} dataSourceLabel={dataSourceLabel} />;
      case 'audit': return <AuditLedger entries={auditLogs} />;
      case 'team': return <UnavailablePage title="Team & Roles" detail="Organization member listing and role management are not connected to this application. Roles remain database-assigned; there is no frontend role editor." />;
      case 'settings': return <UnavailablePage title="Settings" detail="Organization governance settings are not exposed by the current backend." />;
    }
  })();

  return (
    <div className="admin-workspace flex min-h-screen bg-[var(--pl-app-bg)] text-[var(--pl-text)]">
      {mobileOpen && <button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-slate-950/40 md:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[var(--pl-border)] bg-[var(--pl-sidebar)] transition-all md:sticky md:top-0 md:h-screen ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${collapsed ? 'w-[76px]' : 'w-64'}`}>
        <div className="flex h-[68px] items-center justify-between border-b border-[var(--pl-border)] px-4">
          <div className={`flex min-w-0 items-center gap-2.5 ${collapsed ? 'md:justify-center' : ''}`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white"><Shield size={18} /></span>
            {!collapsed && <div className="min-w-0"><p className="truncate text-sm font-semibold">ProofLine</p><p className="truncate text-[11px] text-[var(--pl-muted)]">{organizationLabel}</p></div>}
          </div>
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="rounded-md p-1.5 text-[var(--pl-muted)] hover:bg-[var(--pl-surface-raised)] md:hidden"><X size={18} /></button>
          <button type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="hidden rounded-md p-1.5 text-[var(--pl-muted)] hover:bg-[var(--pl-surface-raised)] md:inline-flex">
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
        {!collapsed && <div className="px-4 pb-3 pt-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--pl-muted)]">Admin Workspace</p></div>}
        <nav aria-label="Admin navigation" className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {navigation.map((item) => (
            <button key={item.id} type="button" title={collapsed ? item.label : undefined} onClick={() => changePage(item.id)} className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors ${page === item.id ? 'bg-blue-600/10 font-medium text-blue-700 dark:text-blue-300' : 'text-[var(--pl-muted)] hover:bg-[var(--pl-surface-raised)] hover:text-[var(--pl-text)]'} ${collapsed ? 'md:justify-center md:px-0' : ''}`}>
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && (item.id === 'reviews' && pendingReviews.length > 0) && <span className="ml-auto rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{pendingReviews.length}</span>}
            </button>
          ))}
        </nav>
        <div className={`border-t border-[var(--pl-border)] p-3 ${collapsed ? 'md:text-center' : ''}`}>
          <div className="flex items-center gap-2 rounded-lg bg-[var(--pl-surface-raised)] p-2.5">
            <Activity size={16} className="shrink-0 text-emerald-600" />
            {!collapsed && <div><p className="text-xs font-medium">Workspace active</p><p className="mt-0.5 text-[10px] text-[var(--pl-muted)]">{publicDemo ? 'Isolated demo state' : 'Organization-scoped Office data'}</p></div>}
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b border-[var(--pl-border)] bg-[var(--pl-surface)] px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="rounded-md p-2 text-[var(--pl-muted)] hover:bg-[var(--pl-surface-raised)] md:hidden"><Menu size={19} /></button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold sm:text-base">{pageTitles[page]}</h1>
              <p className="truncate text-xs text-[var(--pl-muted)]">{organizationLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => changePage('reviews')} aria-label={`${pendingReviews.length} pending reviews`} className="relative rounded-lg border border-[var(--pl-border)] p-2 text-[var(--pl-muted)] hover:bg-[var(--pl-surface-raised)]">
              <Bell size={17} />
              {pendingReviews.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-semibold text-white">{pendingReviews.length}</span>}
            </button>
            <ThemeSelector compact />
            <span className="hidden items-center gap-1.5 rounded-lg border border-[var(--pl-border)] px-2.5 py-2 text-xs font-medium sm:inline-flex"><Shield size={14} className="text-blue-600" /> Admin</span>
            {(publicDemo || canSwitchWorkspace) && (
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--pl-border)] px-2.5 py-2 text-xs font-medium">
                <span className="hidden sm:inline">Switch Workspace</span>
                <span className="sm:hidden">Workspace</span>
                <select aria-label={publicDemo ? 'Switch Evaluation workspace' : 'Switch authorized Office workspace'} value="admin" onChange={(event) => onSwitchWorkspace(event.target.value as DemoWorkspace)} className="max-w-36 cursor-pointer bg-transparent text-xs outline-none">
                  {(publicDemo ? ['admin', 'creator', 'reviewer'] : availableOfficeRoles).map((role) => (
                    <option key={role} value={role}>{role === 'creator' ? 'Content Creator' : role === 'admin' ? 'Admin' : 'Reviewer'}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
          {error && <div role="alert" className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</div>}
          <div className={`mb-5 flex items-start gap-2 rounded-lg border px-3.5 py-3 text-xs ${publicDemo ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200'}`}>
            <Gauge size={15} className="mt-0.5 shrink-0" />
            <p>{publicDemo ? `Demonstration workspace · ${dataSourceLabel}.` : `Office Workspace · ${dataSourceLabel}.`}</p>
          </div>
          {content}
        </main>
      </div>
    </div>
  );
};

function PendingItem({ title, count, onClick }: { title: string; count: number; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--pl-border)] px-3 py-2.5 text-left hover:bg-[var(--pl-surface-raised)]">
    <span className="text-sm">{title}</span><span className="flex items-center gap-2 text-xs text-[var(--pl-muted)]">{count}<ArrowRight size={14} /></span>
  </button>;
}

function QuickAction({ icon, label, onClick, disabled, note }: { icon: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean; note?: string }) {
  return <button type="button" onClick={onClick} disabled={disabled} title={note} className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--pl-border)] px-3 text-left text-sm font-medium hover:border-blue-300 hover:bg-[var(--pl-surface-raised)] disabled:cursor-not-allowed disabled:opacity-50">
    <span className="text-blue-600">{icon}</span>{label}
  </button>;
}

function StatusBadge({ status }: { status: string }) {
  const tone = status.includes('approved') ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : status.includes('invalidated') || status.includes('rejected') ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
      : status.includes('review') || status.includes('draft') ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : 'bg-slate-500/10 text-slate-600 dark:text-slate-300';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${tone}`}>{status}</span>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="px-5 py-12 text-center"><p className="text-sm font-medium">{title}</p><p className="mt-1 text-sm text-[var(--pl-muted)]">{detail}</p></div>;
}

function AuditLedger({ entries }: { entries: AuditLogEntry[] }) {
  return (
    <section className={`${surface} overflow-hidden`}>
      <div className="border-b border-[var(--pl-border)] px-5 py-4">
        <h2 className="text-lg font-semibold">Audit Ledger</h2>
        <p className="mt-1 text-sm text-[var(--pl-muted)]">Recorded governance events available in this workspace.</p>
      </div>
      {entries.length ? <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-[var(--pl-surface-raised)] text-xs font-semibold text-[var(--pl-muted)]"><tr><th className="px-4 py-3">Event / Action</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Affected resource</th><th className="px-4 py-3">Version / details</th><th className="px-4 py-3">Timestamp</th></tr></thead>
          <tbody className="divide-y divide-[var(--pl-border)]">{entries.map((entry) => <tr key={entry.id}>
            <td className="px-4 py-3"><p className="font-medium">{entry.action.replaceAll('_', ' ')}</p><p className="mt-0.5 text-xs text-[var(--pl-muted)]">{entry.id}</p></td>
            <td className="px-4 py-3">{entry.actor}<p className="mt-0.5 text-xs text-[var(--pl-muted)]">{entry.role}</p></td>
            <td className="px-4 py-3">{entry.target}</td>
            <td className="max-w-sm px-4 py-3 text-xs text-[var(--pl-muted)]">{entry.factVersion || entry.details}</td>
            <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--pl-muted)]">{entry.timestamp}</td>
          </tr>)}</tbody>
        </table>
      </div> : <EmptyState title="No audit events" detail="Recorded changes and decisions will appear here." />}
    </section>
  );
}

function UnavailablePage({ title, detail }: { title: string; detail: string }) {
  return <section className={`${surface} p-6 sm:p-8`}><h2 className="text-xl font-semibold">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--pl-muted)]">{detail}</p></section>;
}
