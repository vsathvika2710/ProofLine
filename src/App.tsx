import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Sidebar, TabType } from './components/Sidebar';
import { ProductLanding } from './components/Showcase/ProductLanding';
import { ImpactDashboard } from './components/ChangeImpact/ImpactDashboard';
import { FactList } from './components/EvidenceVault/FactList';
import { ContentScanner } from './components/ContentReviewer/ContentScanner';
import { ReviewQueue } from './components/ReviewCenter/ReviewQueue';
import { MetricsOverview } from './components/GovernanceAnalytics/MetricsOverview';
import { SubmissionDossierModal } from './components/Round2Dossier/SubmissionDossierModal';
import { DemoGuideBanner } from './components/DemoWalkthrough/DemoGuideBanner';
import { ModeLanding } from './components/Entry/ModeLanding';
import { OfficeLogin } from './components/Entry/OfficeLogin';
import { GuestScanner } from './components/Entry/GuestScanner';
import { EntryLayout } from './components/Entry/EntryLayout';
import { RoleSelection } from './components/Entry/RoleSelection';
import { EvaluationRoleSelection } from './components/Entry/EvaluationRoleSelection';
import { ThemeProvider } from './theme/ThemeProvider';
import { SCENARIOS, INITIAL_REVIEW_TASKS, INITIAL_AUDIT_LOGS } from './data/mockData';
import { Fact, UserRole, ReviewTask, AuditLogEntry, ChangeImpactResult } from './types';
import { getOfficeSession, getWorkspace, officeSignOut, selectOfficeWorkspace } from './services/officeAuth';
import { checkEvaluationAccess } from './services/evaluationAccess';
import {
  createEvaluationDemoAuditLogs,
  createEvaluationDemoReviewTasks,
  createEvaluationDemoScenario,
} from './services/evaluationDemo';
import { AdminWorkspace } from './components/AdminWorkspace/AdminWorkspace';
import { CreatorWorkspace } from './components/CreatorWorkspace/CreatorWorkspace';
import { ReviewerWorkspace } from './components/ReviewerWorkspace/ReviewerWorkspace';
import {
  decideEvaluationDemoReview,
  initializeEvaluationDemoSession,
  listEvaluationDemoReviewTasks,
} from './services/evaluationDemoWorkspace';
import {
  changeOfficeFact,
  createOfficeFact,
  decideOfficeReview,
  listOfficeAdminWorkspace,
} from './services/officeWorkspace';

export function OfficeDashboard({ publicDemo = false }: { publicDemo?: boolean }) {
  const { role: routeRole } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const demoRole = routeRole === 'admin' || routeRole === 'creator' || routeRole === 'reviewer'
    ? routeRole
    : 'admin';
  const [scenarioId, setScenarioId] = useState<string>('smartwatch');
  const [selectedTab, setSelectedTab] = useState<TabType>('landing');
  const initialOfficeRole: UserRole =
    demoRole === 'creator' ? 'content_creator'
      : demoRole === 'admin' ? 'brand_manager'
        : 'legal_compliance';
  const [selectedRole, setSelectedRole] = useState<UserRole>(initialOfficeRole);
  const activeRole = publicDemo ? initialOfficeRole : selectedRole;
  const [isJudgeDemo, setIsJudgeDemo] = useState(publicDemo);
  const [availableOfficeRoles, setAvailableOfficeRoles] = useState<Array<'creator' | 'reviewer' | 'admin'>>(
    publicDemo ? ['admin', 'creator', 'reviewer'] : [],
  );
  const [officeOrganizationId, setOfficeOrganizationId] = useState<string | null>(null);
  const [officeAdminLoaded, setOfficeAdminLoaded] = useState(publicDemo || routeRole !== 'admin');
  const [officeAdminError, setOfficeAdminError] = useState('');
  const [isDossierOpen, setIsDossierOpen] = useState<boolean>(false);
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);
  const [tourStep, setTourStep] = useState<number>(0);

  useEffect(() => {
    let active = true;
    if (!publicDemo) {
      void getOfficeSession().then(async (session) => {
        if (!session) return;
        try {
          const workspace = await getWorkspace(session);
          if (!active) return;
          setIsJudgeDemo(false);
          setAvailableOfficeRoles(workspace.accountType !== 'judge_demo' ? workspace.availableRoles : []);
          setOfficeOrganizationId(workspace.organizationId);
          if (routeRole === 'admin') {
            setOfficeAdminLoaded(false);
            setOfficeAdminError('');
            try {
              const data = await listOfficeAdminWorkspace();
              if (!active) return;
              setFacts(data.facts);
              setDocuments(data.documents);
              setAssets(data.assets);
              setTasks(data.tasks);
              setAuditLogs(data.auditLogs);
            } catch (cause) {
              if (active) setOfficeAdminError(cause instanceof Error ? cause.message : 'Could not load organization-scoped Admin data.');
            } finally {
              if (active) setOfficeAdminLoaded(true);
            }
          }
        } catch {
          if (active) navigate('/office/login', { replace: true });
        }
      });
    }
    return () => { active = false; };
  }, [navigate, publicDemo, routeRole]);

  // Active scenario data
  const demoScenario = useMemo(
    () => publicDemo ? createEvaluationDemoScenario() : null,
    [publicDemo],
  );
  const currentScenario = publicDemo
    ? demoScenario!
    : SCENARIOS[scenarioId] || SCENARIOS.smartwatch;
  const [facts, setFacts] = useState<Fact[]>(currentScenario.facts);
  const [documents, setDocuments] = useState(currentScenario.documents);
  const [assets, setAssets] = useState(currentScenario.assets);
  const [tasks, setTasks] = useState<ReviewTask[]>(() => publicDemo
    ? createEvaluationDemoReviewTasks()
    : INITIAL_REVIEW_TASKS.map((task) => ({
      ...task,
      auditTrail: task.auditTrail.map((event) => ({ ...event })),
    })),
  );
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => publicDemo
    ? createEvaluationDemoAuditLogs()
    : INITIAL_AUDIT_LOGS.map((entry) => ({ ...entry })),
  );
  const [demoQueueError, setDemoQueueError] = useState('');
  useEffect(() => {
    if (publicDemo) setSelectedTab(demoRole === 'reviewer' ? 'review_center' : 'landing');
  }, [demoRole, publicDemo]);

  useEffect(() => {
    if (!publicDemo || demoRole !== 'reviewer') return;
    let active = true;
    setDemoQueueError('');
    void listEvaluationDemoReviewTasks()
      .then(({ tasks: demoTasks }) => {
        if (active) setTasks(demoTasks);
      })
      .catch((cause: unknown) => {
        if (active) setDemoQueueError(cause instanceof Error ? cause.message : 'Could not load the session Reviewer Queue.');
      });
    return () => { active = false; };
  }, [demoRole, publicDemo]);

  const refreshOfficeAdmin = async () => {
    const data = await listOfficeAdminWorkspace();
    setFacts(data.facts);
    setDocuments(data.documents);
    setAssets(data.assets);
    setTasks(data.tasks);
    setAuditLogs(data.auditLogs);
    return data;
  };
  const demoPermissions: Record<typeof demoRole, TabType[]> = {
    admin: ['landing', 'impact', 'vault', 'reviewer', 'review_center', 'analytics', 'dossier'],
    creator: ['landing', 'reviewer'],
    reviewer: ['landing', 'vault', 'review_center'],
  };
  const activeTab = publicDemo && !demoPermissions[demoRole].includes(selectedTab)
    ? 'landing'
    : selectedTab;
  const selectTab = (tab: TabType) => {
    if (publicDemo) {
      if (!demoPermissions[demoRole].includes(tab)) {
        setSelectedTab(demoRole === 'creator' ? 'reviewer' : 'review_center');
        return;
      }
    }
    setSelectedTab(tab);
  };

  const handleSwitchWorkspace = async (workspace: 'admin' | 'creator' | 'reviewer') => {
    if (publicDemo) {
      navigate(`/evaluation/dashboard/${workspace}`);
      return;
    }
    const session = await getOfficeSession();
    if (!session) {
      navigate('/office/login', { replace: true });
      return;
    }
    await selectOfficeWorkspace(session, workspace);
    navigate(`/office/dashboard/${workspace}`);
  };

  // Switch scenario
  const handleSelectScenario = (id: string) => {
    if (publicDemo) return;
    setScenarioId(id);
    const scen = SCENARIOS[id] || SCENARIOS.smartwatch;
    setFacts(scen.facts);
    setDocuments(scen.documents);
    setAssets(scen.assets);
    // Keep scenario demo data isolated instead of carrying review/audit state across scenarios.
    setTasks(INITIAL_REVIEW_TASKS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
  };

  // Fact updated via Change Impact Engine
  const handleFactUpdated = (updatedFact: Fact, impact: ChangeImpactResult) => {
    if (!publicDemo) {
      return (async () => {
        setOfficeAdminError('');
        try {
          const committedImpact = await changeOfficeFact(updatedFact.id, updatedFact.currentValue);
          await refreshOfficeAdmin();
          return committedImpact;
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : 'The organization fact could not be updated.';
          setOfficeAdminError(message);
          throw cause;
        }
      })();
    }

    // 1. Update facts list
    setFacts((prev) => prev.map((f) => (f.id === updatedFact.id ? updatedFact : f)));

    // 2. Mark affected assets as approval_invalidated
    setAssets((prev) =>
      prev.map((asset) => {
        const isAffected = impact.affectedAssets.some((a) => a.assetId === asset.id);
        if (isAffected) {
          return {
            ...asset,
            status: 'approval_invalidated',
            issuesCount: asset.issuesCount + 1,
          };
        }
        return asset;
      })
    );

    // 3. Create or update review tasks
    const newTasks: ReviewTask[] = impact.affectedAssets.map((affected, idx) => ({
      id: `TASK-CAS-${Date.now()}-${idx}`,
      assetId: affected.assetId,
      assetTitle: affected.assetTitle,
      assetType: affected.assetType,
      trigger: 'fact_change_cascade',
      triggerFactId: updatedFact.id,
      priority: 'critical',
      status: 'pending',
      assignedRole: 'legal_compliance',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      originalText: `Contains superseded statement: "${affected.affectedClaims[0]?.claimText}"`,
      suggestedText: `Updated standard: "${updatedFact.currentValue}" as per ${updatedFact.sourceDocName}`,
      currentText: `Updated standard: "${updatedFact.currentValue}"`,
      notes: affected.affectedClaims[0]?.reason,
      auditTrail: [
        {
          action: 'CASCADE_INVALIDATION',
          by: 'Change Impact Engine',
          role: 'system',
          timestamp: new Date().toISOString(),
          note: `Triggered by ${updatedFact.code} delta: ${updatedFact.previousValue} -> ${updatedFact.currentValue}`,
        },
      ],
    }));

    setTasks((prev) => [...newTasks, ...prev]);

    // 4. Log audit entries
    const log1: AuditLogEntry = {
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actor: activeRole === 'legal_compliance' ? 'Sarah Chen' : 'Liam Kelly',
      role: activeRole,
      action: 'FACT_UPDATED',
      target: `${updatedFact.code} (${updatedFact.name})`,
      details: `Value modified from "${updatedFact.previousValue}" to "${updatedFact.currentValue}".`,
      factVersion: updatedFact.version,
    };

    const log2: AuditLogEntry = {
      id: `LOG-${Date.now() + 1}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actor: 'Change Impact Engine',
      role: 'system',
      action: 'IMPACT_EVALUATED',
      target: `Global Asset Catalog (${assets.length} assets evaluated)`,
      details: `Cascade analysis invalidated ${impact.affectedAssets.length} assets. ${impact.unaffectedAssets.length} verified stable.`,
    };

    setAuditLogs((prev) => [log2, log1, ...prev]);
  };

  // Create review task from Content Scanner
  const handleCreateTask = (taskData: Partial<ReviewTask>) => {
    const newTask: ReviewTask = {
      id: `TASK-SCAN-${Date.now()}`,
      assetId: 'ASSET-MANUAL',
      assetTitle: taskData.assetTitle || 'Ad-Hoc Content Draft',
      assetType: taskData.assetType || 'website_page',
      trigger: 'content_scan',
      priority: taskData.priority || 'high',
      status: 'pending',
      assignedRole: taskData.assignedRole || 'legal_compliance',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      originalText: taskData.originalText || '',
      suggestedText: taskData.suggestedText || '',
      currentText: taskData.currentText || '',
      notes: taskData.notes,
      auditTrail: taskData.auditTrail || [],
    };

    setTasks((prev) => [newTask, ...prev]);

    const newLog: AuditLogEntry = {
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actor: 'Claim Intelligence Engine',
      role: 'system',
      action: 'ASSET_CREATED',
      target: newTask.assetTitle,
      details: 'Task queued for reviewer verification from pre-publication scan.',
    };

    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Update task from Review Center (e.g. approve or reject)
  const handleUpdateTask = async (updatedTask: ReviewTask, log: AuditLogEntry) => {
    if (publicDemo && demoRole === 'reviewer') {
      const decision = updatedTask.status === 'approved' ? 'approve' : 'request_revision';
      const result = await decideEvaluationDemoReview(
        updatedTask.id,
        decision,
        updatedTask.notes || log.details,
        updatedTask.currentText,
      );
      setTasks((prev) => prev.map((task) => task.id === result.task.id ? result.task : task));
      setAuditLogs((prev) => [log, ...prev]);
      return;
    }

    if (!publicDemo) {
      const decision = updatedTask.status === 'approved' ? 'approve' : 'request_revision';
      await decideOfficeReview(updatedTask.id, decision, updatedTask.notes || log.details, 'admin');
      await refreshOfficeAdmin();
      return;
    }

    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
    setAuditLogs((prev) => [log, ...prev]);

    // If approved, update the corresponding asset to 'approved'
    if (updatedTask.status === 'approved') {
      setAssets((prev) =>
        prev.map((a) => {
          if (a.id === updatedTask.assetId) {
            return {
              ...a,
              status: 'approved',
              issuesCount: Math.max(0, a.issuesCount - 1),
              lastApprovedBy: updatedTask.reviewedBy,
              lastApprovedDate: updatedTask.reviewedAt,
            };
          }
          return a;
        })
      );
    }
  };

  const handleSelectFactForImpact = (_factId: string) => {
    selectTab('impact');
  };

  const pendingTasksCount = tasks.filter((t) => t.status === 'pending').length;

  if (!publicDemo && routeRole === 'admin' && !officeAdminLoaded) {
    return <EntryLayout><main className="entry-main flex min-h-screen items-center justify-center px-4 text-sm text-slate-400">Loading authorized organization workspace…</main></EntryLayout>;
  }

  if (routeRole === 'admin') {
    return (
      <AdminWorkspace
        publicDemo={publicDemo}
        organizationLabel={publicDemo
          ? 'NovaWear Demo'
          : officeOrganizationId
            ? `Organization ID: ${officeOrganizationId}`
            : 'Authorized organization'}
        scenario={currentScenario}
        facts={facts}
        documents={documents}
        assets={assets}
        tasks={tasks}
        auditLogs={auditLogs}
        activeRole={activeRole}
        onFactUpdated={handleFactUpdated}
        onAddFact={(fact) => {
          if (publicDemo) {
            setFacts((prev) => [fact, ...prev]);
            return;
          }
          setOfficeAdminError('');
          void createOfficeFact(fact)
            .then(() => refreshOfficeAdmin())
            .catch((cause: unknown) => setOfficeAdminError(cause instanceof Error ? cause.message : 'The approved fact could not be saved.'));
        }}
        onCreateTask={handleCreateTask}
        onUpdateTask={handleUpdateTask}
        onSwitchWorkspace={(workspace) => void handleSwitchWorkspace(workspace)}
        canSwitchWorkspace={!publicDemo && availableOfficeRoles.length > 1}
        availableOfficeRoles={availableOfficeRoles}
        canManageOfficeData={!publicDemo && availableOfficeRoles.includes('admin')}
        error={officeAdminError}
      />
    );
  }

  if (routeRole === 'creator') {
    return (
      <CreatorWorkspace
        publicDemo={publicDemo}
        organizationLabel={publicDemo ? 'NovaWear Demo' : officeOrganizationId ? `Organization ID: ${officeOrganizationId}` : 'Authorized organization'}
        canSwitchWorkspace={!publicDemo && availableOfficeRoles.length > 1}
        availableOfficeRoles={availableOfficeRoles}
        onSwitchWorkspace={publicDemo || availableOfficeRoles.length > 1 ? handleSwitchWorkspace : undefined}
        onLogout={!publicDemo ? async () => {
          await officeSignOut();
          navigate('/office/login', { replace: true });
        } : undefined}
      />
    );
  }

  if (routeRole === 'reviewer') {
    return (
      <ReviewerWorkspace
        organizationLabel={publicDemo ? 'NovaWear Demo' : officeOrganizationId ? `Organization ID: ${officeOrganizationId}` : 'Authorized organization'}
        publicDemo={publicDemo}
        canSwitchWorkspace={!publicDemo && availableOfficeRoles.length > 1}
        availableOfficeRoles={availableOfficeRoles}
        onSwitchWorkspace={handleSwitchWorkspace}
        onLogout={!publicDemo ? async () => {
          await officeSignOut();
          navigate('/office/login', { replace: true });
        } : undefined}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#06080e] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navbar */}
      <Navbar
        currentScenario={scenarioId}
        onSelectScenario={handleSelectScenario}
        activeRole={activeRole}
        onSelectRole={setSelectedRole}
        isJudgeDemo={isJudgeDemo}
        canSwitchWorkspace={!publicDemo && availableOfficeRoles.length > 1}
        availableOfficeRoles={publicDemo ? ['admin', 'creator', 'reviewer'] : availableOfficeRoles}
        publicDemo={publicDemo}
        onSelectOfficeRole={async (officeRole) => {
          if (publicDemo) {
            navigate(`/evaluation/dashboard/${officeRole}`);
            return;
          }
          const session = await getOfficeSession();
          if (!session) {
            navigate('/office/login', { replace: true });
            return;
          }
          await selectOfficeWorkspace(session, officeRole);
          navigate(`/office/dashboard/${officeRole}`);
        }}
        onLogout={!publicDemo ? async () => {
          await officeSignOut();
          navigate('/office/login', { replace: true });
        } : undefined}
        activeTab={activeTab}
        onSelectTab={selectTab}
        onOpenDossier={() => setIsDossierOpen(true)}
        onStartTour={() => {
          setIsTourOpen(true);
          setTourStep(0);
          selectTab('vault');
        }}
      />

      {/* Main Body */}
      {activeTab === 'landing' ? (
        <main className="flex-1 px-4 lg:px-8 py-8 max-w-7xl mx-auto w-full">
          <ProductLanding
            onLaunchApp={(tab) => selectTab(tab)}
            onStartTour={() => {
              setIsTourOpen(true);
              setTourStep(0);
              selectTab('vault');
            }}
            onOpenDossier={() => setIsDossierOpen(true)}
            onSelectScenario={handleSelectScenario}
          />
        </main>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          <Sidebar
            activeTab={activeTab}
            onSelectTab={selectTab}
            pendingTasksCount={pendingTasksCount}
            factsCount={facts.length}
            activeOfficeRole={
              routeRole === 'creator' ? 'creator'
                : routeRole === 'reviewer' ? 'reviewer'
                  : 'admin'
            }
          />

          <main className="flex-1 p-4 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
            {activeTab === 'impact' && (
              <ImpactDashboard
                facts={facts}
                assets={assets}
                onFactUpdated={handleFactUpdated}
                onNavigateToReviews={() => selectTab('review_center')}
              />
            )}

            {activeTab === 'vault' && (
              <FactList
                facts={facts}
                documents={documents}
                onSelectFactForImpact={handleSelectFactForImpact}
                onAddNewFact={(newFact) => setFacts((prev) => [newFact, ...prev])}
              />
            )}

            {activeTab === 'reviewer' && (
              <ContentScanner
                scenario={currentScenario}
                facts={facts}
                onCreateReviewTask={handleCreateTask}
                onNavigateToReviews={() => selectTab('review_center')}
              />
            )}

            {activeTab === 'review_center' && (
              <>
                {demoQueueError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"><span>{demoQueueError}</span><button type="button" onClick={() => {
                  setDemoQueueError('');
                  void listEvaluationDemoReviewTasks()
                    .then(({ tasks: demoTasks }) => setTasks(demoTasks))
                    .catch((cause: unknown) => setDemoQueueError(cause instanceof Error ? cause.message : 'Could not load the session Reviewer Queue.'));
                }} className="font-semibold underline">Retry</button></div>}
                <ReviewQueue
                  tasks={tasks}
                  auditLogs={auditLogs}
                  activeRole={activeRole}
                  onUpdateTask={handleUpdateTask}
                />
              </>
            )}

            {activeTab === 'analytics' && (
              <MetricsOverview facts={facts} documents={documents} assets={assets} />
            )}

            {activeTab === 'dossier' && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4">
                <h3 className="text-xl font-bold text-white">Round 2 Submission Pack</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Access the complete 100-point rubric breakdown, architectural decisions, and
                  evidence ledger.
                </p>
                <button
                  onClick={() => setIsDossierOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-all shadow-lg shadow-cyan-900/30"
                >
                  Launch Round 2 Dossier Modal
                </button>
              </div>
            )}
          </main>
        </div>
      )}

      {/* Round 2 Dossier Modal */}
      <SubmissionDossierModal isOpen={isDossierOpen} onClose={() => setIsDossierOpen(false)} />

      {/* Guided Judge Tour Banner */}
      {isTourOpen && (
        <DemoGuideBanner
          currentStep={tourStep}
          totalSteps={5}
          onNextStep={() => setTourStep((s) => Math.min(4, s + 1))}
          onPrevStep={() => setTourStep((s) => Math.max(0, s - 1))}
          onJumpToStep={(idx) => setTourStep(idx)}
          onClose={() => setIsTourOpen(false)}
          onSelectTab={selectTab}
        />
      )}
    </div>
  );
}

function OfficeWorkspaceRoute() {
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void getOfficeSession().then(async (session) => {
      if (!session) {
        if (active) navigate('/office/login', { replace: true });
        return;
      }
      try {
        const requested = role as 'creator' | 'reviewer' | 'admin';
        if (!['creator', 'reviewer', 'admin'].includes(requested)) throw new Error('Unknown workspace.');
        const workspace = await getWorkspace(session, requested);
        if (workspace.accountType === 'judge_demo') {
          throw new Error('Evaluation accounts must use Evaluation Access.');
        }
        if (!workspace.availableRoles.includes(requested)) throw new Error('This dashboard is not assigned to your account.');
        if (workspace.availableRoles.length === 1 && workspace.assignedRole !== requested) {
          throw new Error('This dashboard is not assigned to your account.');
        }
        if (active) setAllowed(true);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Office access was denied.');
      }
    });
    return () => { active = false; };
  }, [navigate, role]);

  if (error) {
    return (
      <EntryLayout>
        <main className="entry-main flex min-h-screen items-center justify-center px-4">
          <section className="portal-panel max-w-lg rounded-2xl p-8 text-center">
            <h1 className="text-xl font-bold text-white">Office access denied</h1>
            <p className="mt-2 text-sm text-slate-400">{error}</p>
            <button type="button" onClick={() => navigate('/office/login')} className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              Return to sign in
            </button>
          </section>
        </main>
      </EntryLayout>
    );
  }
  if (!allowed) {
    return <EntryLayout><main className="entry-main flex min-h-screen items-center justify-center text-sm text-slate-400">Restoring authorized workspace…</main></EntryLayout>;
  }
  return <OfficeDashboard />;
}

function EvaluationWorkspaceRoute() {
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState('');
  const [errorTitle, setErrorTitle] = useState('Could not verify demo availability');
  const [isChecking, setIsChecking] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const retry = () => {
    setAllowed(false);
    setError('');
    setErrorTitle('Could not verify demo availability');
    setIsChecking(true);
    setAttempt((value) => value + 1);
  };

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void checkEvaluationAccess(controller.signal)
      .then(async (isEnabled) => {
        if (!active) return;
        if (!isEnabled) {
          navigate('/', { replace: true });
          return;
        }
        if (!['creator', 'reviewer', 'admin'].includes(role || '')) {
          throw new Error('Unknown demonstration workspace.');
        }
        setErrorTitle('Could not open demo workspace');
        await initializeEvaluationDemoSession();
        if (!active) return;
        setAllowed(true);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not verify demonstration access. Retry the request.');
      })
      .finally(() => {
        if (active) setIsChecking(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt, navigate, role]);

  if (error) {
    return (
      <EntryLayout>
        <main className="entry-main flex min-h-screen items-center justify-center px-4">
          <section className="portal-panel max-w-lg rounded-2xl p-8 text-center">
            <h1 className="text-xl font-bold text-white">{errorTitle}</h1>
            <p className="mt-2 text-sm text-slate-400">{error}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={retry} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Retry</button>
              <button type="button" onClick={() => navigate('/evaluation/workspaces')} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300">
                Return to demo workspaces
              </button>
            </div>
          </section>
        </main>
      </EntryLayout>
    );
  }
  if (isChecking || !allowed) {
    return <EntryLayout><main className="entry-main flex min-h-screen items-center justify-center text-sm text-slate-400">Verifying demonstration workspace…</main></EntryLayout>;
  }
  return <OfficeDashboard publicDemo />;
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ThemeProvider>
        <Routes>
          <Route path="/" element={<EntryLayout><ModeLanding /></EntryLayout>} />
          <Route path="/office/login" element={<EntryLayout><OfficeLogin /></EntryLayout>} />
          <Route path="/office/roles" element={<EntryLayout><RoleSelection /></EntryLayout>} />
          <Route path="/office/dashboard/:role" element={<OfficeWorkspaceRoute />} />
          <Route path="/office/dashboard" element={<Navigate to="/office/login" replace />} />
          <Route path="/evaluation/login" element={<Navigate to="/evaluation/workspaces" replace />} />
          <Route path="/evaluation/workspaces" element={<EntryLayout><EvaluationRoleSelection /></EntryLayout>} />
          <Route path="/evaluation/dashboard/:role" element={<EvaluationWorkspaceRoute />} />
          <Route path="/guest" element={<EntryLayout><GuestScanner /></EntryLayout>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ThemeProvider>
    </BrowserRouter>
  );
}
