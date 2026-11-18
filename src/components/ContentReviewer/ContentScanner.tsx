import React, { useState, useEffect } from 'react';
import {
  ScanText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Wand2,
  Send,
  FileCheck,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
  RotateCcw,
} from 'lucide-react';
import { Fact, Claim, ScenarioDataset, ReviewTask } from '../../types';
import { analyzeContent } from '../../services/claimEngine';

interface ContentScannerProps {
  scenario: ScenarioDataset;
  facts: Fact[];
  onCreateReviewTask: (task: Partial<ReviewTask>) => void;
  onNavigateToReviews: () => void;
}

export const ContentScanner: React.FC<ContentScannerProps> = ({
  scenario,
  facts,
  onCreateReviewTask,
  onNavigateToReviews,
}) => {
  const [content, setContent] = useState<string>(scenario.sampleTexts[0]?.text || '');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState(() =>
    analyzeContent(scenario.sampleTexts[0]?.text || '', facts)
  );
  const [appliedFixes, setAppliedFixes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (scenario.sampleTexts[0]) {
      setContent(scenario.sampleTexts[0].text);
      setAnalysisResult(analyzeContent(scenario.sampleTexts[0].text, facts));
      setAppliedFixes({});
    }
  }, [scenario.id, facts]);

  const handleScan = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      const res = analyzeContent(content, facts);
      setAnalysisResult(res);
      setIsAnalyzing(false);
    }, 350);
  };

  const handleApplyFix = (claim: Claim) => {
    if (!claim.suggestedCorrection) return;

    // Replace the problematic text with the suggested correction
    const newContent = content.replace(claim.text, claim.suggestedCorrection);
    setContent(newContent);
    setAppliedFixes((prev) => ({ ...prev, [claim.id]: true }));

    // Re-analyze after fix
    setTimeout(() => {
      setAnalysisResult(analyzeContent(newContent, facts));
    }, 100);
  };

  const handleSendToReview = () => {
    onCreateReviewTask({
      assetTitle: 'Unpublished Campaign Copy Draft',
      assetType: 'website_page',
      trigger: 'content_scan',
      priority: analysisResult.stats.contradicted > 0 ? 'critical' : 'high',
      status: 'pending',
      assignedRole: 'legal_compliance',
      originalText: content,
      suggestedText: content,
      currentText: content,
      notes: `Pre-publication scan flagged ${analysisResult.stats.contradicted + analysisResult.stats.outdated} compliance issues.`,
      auditTrail: [
        {
          action: 'FLAGGED_IN_SCAN',
          by: 'Claim Intelligence Engine',
          role: 'system',
          timestamp: new Date().toISOString(),
          note: `Compliance score: ${analysisResult.overallScore}%`,
        },
      ],
    });
    onNavigateToReviews();
  };

  const statusBadges: Record<Claim['status'], { label: string; bg: string; text: string; icon: any }> = {
    supported: {
      label: 'SUPPORTED',
      bg: 'bg-emerald-500/20 border-emerald-500/30',
      text: 'text-emerald-300',
      icon: CheckCircle2,
    },
    outdated: {
      label: 'OUTDATED FACT',
      bg: 'bg-amber-500/20 border-amber-500/30',
      text: 'text-amber-300',
      icon: AlertTriangle,
    },
    contradicted: {
      label: 'CONTRADICTED',
      bg: 'bg-red-500/20 border-red-500/30',
      text: 'text-red-300',
      icon: XCircle,
    },
    unsupported: {
      label: 'UNSUPPORTED CLAIM',
      bg: 'bg-orange-500/20 border-orange-500/30',
      text: 'text-orange-300',
      icon: HelpCircle,
    },
    tone_issue: {
      label: 'BRAND TERMINOLOGY',
      bg: 'bg-purple-500/20 border-purple-500/30',
      text: 'text-purple-300',
      icon: Wand2,
    },
    accessibility: {
      label: 'ACCESSIBILITY',
      bg: 'bg-blue-500/20 border-blue-500/30',
      text: 'text-blue-300',
      icon: Wand2,
    },
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Loaders */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Content &amp; Claim Intelligence
            </h2>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Module 2 &amp; 3
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Pre-publication validator: Extracts claims, cross-checks Evidence Vault, and catches
            outdated warranties, prohibited superlatives, and active ingredient errors.
          </p>
        </div>

        {/* Quick Sample Text Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-slate-400">Load Preset:</span>
          {scenario.sampleTexts.map((sample) => (
            <button
              key={sample.id}
              onClick={() => {
                setContent(sample.text);
                setAnalysisResult(analyzeContent(sample.text, facts));
                setAppliedFixes({});
              }}
              className="px-2.5 py-1 text-xs rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-medium transition-all"
            >
              {sample.title}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Layout: Editor Left, Analysis Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Text Area and Scanner Actions (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase text-slate-400 font-semibold flex items-center gap-1.5">
                <ScanText className="w-4 h-4 text-cyan-400" />
                Pre-Publication Content Staging
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {content.length} chars · {content.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>

            <textarea
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste or write draft marketing copy, brochure text, website page, or social caption here..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 font-sans leading-relaxed transition-all resize-y"
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleScan}
                  disabled={isAnalyzing}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-md shadow-cyan-900/30 flex items-center gap-2 font-mono"
                >
                  <ScanText className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  <span>{isAnalyzing ? 'Extracting Claims...' : 'Scan & Verify Claims'}</span>
                </button>
                <button
                  onClick={() => {
                    setContent('');
                    setAnalysisResult(analyzeContent('', facts));
                  }}
                  className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
                  title="Clear Text"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {analysisResult.claims.length > 0 && (
                <button
                  onClick={handleSendToReview}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-md shadow-purple-900/30 flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send to Human Review Queue</span>
                </button>
              )}
            </div>
          </div>

          {/* Supporting Checks & Accessibility Card */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 grid grid-cols-3 gap-3 text-center text-xs">
            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              <div className="text-[10px] uppercase font-mono text-slate-400">Tone &amp; Style</div>
              <div className="text-sm font-bold text-emerald-400 mt-1">Professional / Tech</div>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              <div className="text-[10px] uppercase font-mono text-slate-400">Reading Level</div>
              <div className="text-sm font-bold text-cyan-400 mt-1">Grade 8.4 (Clear)</div>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              <div className="text-[10px] uppercase font-mono text-slate-400">Responsible AI</div>
              <div className="text-sm font-bold text-purple-400 mt-1">Human Gate Active</div>
            </div>
          </div>
        </div>

        {/* Right Column: Claim Analysis & Issue Cards (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Compliance Score Header */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold tracking-wider">
                Brand Governance Score
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  className={`text-3xl font-black font-mono ${
                    analysisResult.overallScore >= 80
                      ? 'text-emerald-400'
                      : analysisResult.overallScore >= 50
                      ? 'text-amber-400'
                      : 'text-red-400'
                  }`}
                >
                  {analysisResult.overallScore}%
                </span>
                <span className="text-xs text-slate-400">
                  ({analysisResult.stats.supported}/{analysisResult.stats.total} verified)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-mono">
              {analysisResult.stats.contradicted > 0 && (
                <span className="px-2 py-1 rounded bg-red-500/20 text-red-300 font-bold border border-red-500/30">
                  {analysisResult.stats.contradicted} Error
                </span>
              )}
              {analysisResult.stats.outdated > 0 && (
                <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  {analysisResult.stats.outdated} Outdated
                </span>
              )}
              {analysisResult.stats.unsupported > 0 && (
                <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-300 font-bold border border-orange-500/30">
                  {analysisResult.stats.unsupported} Unverified
                </span>
              )}
            </div>
          </div>

          {/* Extracted Claims List */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {analysisResult.claims.length === 0 ? (
              <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-8 text-center text-slate-500">
                <ScanText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">No claims detected yet. Click "Scan &amp; Verify Claims" above.</p>
              </div>
            ) : (
              analysisResult.claims.map((claim) => {
                const badge = statusBadges[claim.status];
                const IconComponent = badge.icon;
                const isFixed = appliedFixes[claim.id];

                return (
                  <div
                    key={claim.id}
                    className={`rounded-xl border p-4 transition-all ${
                      claim.status === 'supported'
                        ? 'bg-slate-900/40 border-emerald-500/20'
                        : claim.status === 'outdated'
                        ? 'bg-amber-950/20 border-amber-500/40 shadow-md shadow-amber-950/10'
                        : claim.status === 'contradicted'
                        ? 'bg-red-950/20 border-red-500/40 shadow-md shadow-red-950/10'
                        : 'bg-slate-900/80 border-slate-800'
                    }`}
                  >
                    {/* Top Row: Claim Text + Status Badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                        <span className="text-slate-400">"{claim.text}"</span>
                      </div>
                      <span
                        className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1 ${badge.bg} ${badge.text}`}
                      >
                        <IconComponent className="w-2.5 h-2.5" />
                        {badge.label}
                      </span>
                    </div>

                    {/* AI Explanation & Fact Citation */}
                    <p className="text-xs text-slate-300 leading-relaxed mb-2.5">
                      {claim.explanation}
                    </p>

                    {/* Citation passage if matched */}
                    {claim.sourceCitation && (
                      <div className="bg-slate-950/80 rounded-lg p-2.5 border border-slate-800 text-[11px] mb-3">
                        <div className="text-cyan-400 font-mono font-medium flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Citation: {claim.sourceCitation.documentName} ({claim.sourceCitation.version})</span>
                        </div>
                        <p className="text-slate-400 mt-1 italic line-clamp-2">
                          "{claim.sourceCitation.passage}"
                        </p>
                      </div>
                    )}

                    {/* One-Click Fix Action if issue present */}
                    {claim.status !== 'supported' && claim.suggestedCorrection && (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                        <div className="text-slate-400 text-[11px] font-mono">
                          Fix: <span className="text-emerald-400 font-semibold">{claim.suggestedCorrection}</span>
                        </div>
                        <button
                          onClick={() => handleApplyFix(claim)}
                          disabled={isFixed}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                            isFixed
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm'
                          }`}
                        >
                          {isFixed ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" /> Applied
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3" /> 1-Click Apply
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
