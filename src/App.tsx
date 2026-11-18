import React, { useState } from 'react';
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
import { SCENARIOS, INITIAL_REVIEW_TASKS, INITIAL_AUDIT_LOGS } from './data/mockData';
import { Fact, UserRole, ReviewTask, AuditLogEntry, ChangeImpactResult } from './types';

export function App() {
  const [scenarioId, setScenarioId] = useState<string>('smartwatch');
  const [activeTab, setActiveTab] = useState<TabType>('landing');
  const [activeRole, setActiveRole] = useState<UserRole>('legal_compliance');
  const [isDossierOpen, setIsDossierOpen] = useState<boolean>(false);
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);
  const [tourStep, setTourStep] = useState<number>(0);

  // Active scenario data
  const currentScenario = SCENARIOS[scenarioId] || SCENARIOS.smartwatch;
  const [facts, setFacts] = useState<Fact[]>(currentScenario.facts);
  const [documents, setDocuments] = useState(currentScenario.documents);
  const [assets, setAssets] = useState(currentScenario.assets);
  const [tasks, setTasks] = useState<ReviewTask[]>(INITIAL_REVIEW_TASKS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);

  // Switch scenario
  const handleSelectScenario = (id: string) => {
    setScenarioId(id);
    const scen = SCENARIOS[id] || SCENARIOS.smartwatch;
    setFacts(scen.facts);
    setDocuments(scen.documents);
    setAssets(scen.assets);
  };

  // Fact updated via Change Impact Engine
  const handleFactUpdated = (updatedFact: Fact, impact: ChangeImpactResult) => {
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
  const handleUpdateTask = (updatedTask: ReviewTask, log: AuditLogEntry) => {
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
    setActiveTab('impact');
  };

  const pendingTasksCount = tasks.filter((t) => t.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#06080e] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navbar */}
      <Navbar
        currentScenario={scenarioId}
        onSelectScenario={handleSelectScenario}
        activeRole={activeRole}
        onSelectRole={setActiveRole}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenDossier={() => setIsDossierOpen(true)}
        onStartTour={() => {
          setIsTourOpen(true);
          setTourStep(0);
          setActiveTab('vault');
        }}
      />

      {/* Main Body */}
      {activeTab === 'landing' ? (
        <main className="flex-1 px-4 lg:px-8 py-8 max-w-7xl mx-auto w-full">
          <ProductLanding
            onLaunchApp={(tab) => setActiveTab(tab)}
            onStartTour={() => {
              setIsTourOpen(true);
              setTourStep(0);
              setActiveTab('vault');
            }}
            onOpenDossier={() => setIsDossierOpen(true)}
            onSelectScenario={handleSelectScenario}
          />
        </main>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          <Sidebar
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            pendingTasksCount={pendingTasksCount}
            factsCount={facts.length}
          />

          <main className="flex-1 p-4 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
            {activeTab === 'impact' && (
              <ImpactDashboard
                facts={facts}
                assets={assets}
                onFactUpdated={handleFactUpdated}
                onNavigateToReviews={() => setActiveTab('review_center')}
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
                onNavigateToReviews={() => setActiveTab('review_center')}
              />
            )}

            {activeTab === 'review_center' && (
              <ReviewQueue
                tasks={tasks}
                auditLogs={auditLogs}
                activeRole={activeRole}
                onUpdateTask={handleUpdateTask}
              />
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
          onSelectTab={setActiveTab}
        />
      )}
    </div>
  );
}

export default App;
