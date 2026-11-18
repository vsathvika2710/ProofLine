import React from 'react';
import { Sparkles, ArrowRight, ArrowLeft, Check, X, ShieldAlert, Zap, Database, ScanText, UserCheck2, BarChart3 } from 'lucide-react';
import { TabType } from '../Sidebar';

interface DemoGuideBannerProps {
  currentStep: number;
  totalSteps: number;
  onNextStep: () => void;
  onPrevStep: () => void;
  onJumpToStep: (stepIndex: number) => void;
  onClose: () => void;
  onSelectTab: (tab: TabType) => void;
}

export const DemoGuideBanner: React.FC<DemoGuideBannerProps> = ({
  currentStep,
  totalSteps,
  onNextStep,
  onPrevStep,
  onJumpToStep,
  onClose,
  onSelectTab,
}) => {
  const steps = [
    {
      title: 'Step 1: Single Source of Truth (Evidence Vault)',
      desc: 'Inspect approved facts, policies, and specifications. Notice how FACT-WTY-01 has a source citation from Warranty Policy v3.2.',
      targetTab: 'vault' as TabType,
      icon: Database,
    },
    {
      title: 'Step 2: Change Impact Engine (Signature Feature)',
      desc: 'Simulate a fact change (Warranty 2yr -> 1yr). The engine immediately scans live collateral, invalidates 3 approvals, and draws the dependency graph!',
      targetTab: 'impact' as TabType,
      icon: Zap,
    },
    {
      title: 'Step 3: Pre-Publication Content Scanner',
      desc: 'Test marketing copy drafts. Proofline extracts claims and flags outdated warranties, 100% waterproof superlatives, and non-compliant color names with 1-click fixes.',
      targetTab: 'reviewer' as TabType,
      icon: ScanText,
    },
    {
      title: 'Step 4: Human Review Centre & Diff Approvals',
      desc: 'Open the Review Queue. Inspect side-by-side diffs with suggested AI corrections. Click "Approve & Re-Validate" to witness human oversight in action.',
      targetTab: 'review_center' as TabType,
      icon: UserCheck2,
    },
    {
      title: 'Step 5: Governance Analytics & Audit Ledger',
      desc: 'Review brand health trends, top recurring inconsistencies, evidence expiry alerts, and empirical survey findings from Round 1.',
      targetTab: 'analytics' as TabType,
      icon: BarChart3,
    },
  ];

  const current = steps[currentStep] || steps[0];
  const IconComponent = current.icon;

  const handleStepClick = (index: number) => {
    onJumpToStep(index);
    onSelectTab(steps[index].targetTab);
  };

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl px-4">
      <div className="bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 rounded-2xl p-4 shadow-2xl shadow-cyan-950/50 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Step Indicator & Content */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
            <IconComponent className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                Judges Walkthrough ({currentStep + 1}/{totalSteps})
              </span>
              <h4 className="text-xs font-bold text-white truncate">{current.title}</h4>
            </div>
            <p className="text-xs text-slate-300 mt-1 line-clamp-1 leading-relaxed">
              {current.desc}
            </p>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {currentStep > 0 && (
            <button
              onClick={() => {
                onPrevStep();
                onSelectTab(steps[currentStep - 1].targetTab);
              }}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title="Previous Step"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          {currentStep < totalSteps - 1 ? (
            <button
              onClick={() => {
                onNextStep();
                onSelectTab(steps[currentStep + 1].targetTab);
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-all flex items-center gap-1 shadow-md shadow-cyan-900/30"
            >
              <span>Next Step</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-1 shadow-md"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Finish Tour</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            title="Dismiss Tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
