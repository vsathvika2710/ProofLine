import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, KeyRound, ScanText, ShieldCheck } from 'lucide-react';
import { checkEvaluationAccess } from '../../services/evaluationAccess';

export const ModeLanding: React.FC = () => {
  const navigate = useNavigate();
  const [evaluationStatus, setEvaluationStatus] = useState<'checking' | 'enabled' | 'disabled' | 'error'>('checking');
  const [evaluationError, setEvaluationError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const retryEvaluationCheck = () => {
    setEvaluationError('');
    setEvaluationStatus('checking');
    setAttempt((value) => value + 1);
  };

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void checkEvaluationAccess(controller.signal)
      .then((enabled) => {
        if (active) setEvaluationStatus(enabled ? 'enabled' : 'disabled');
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setEvaluationError(cause instanceof Error ? cause.message : 'Could not check demo availability. Retry the request.');
        setEvaluationStatus('error');
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt]);

  return (
    <main className="entry-main flex min-h-screen items-center justify-center px-4 pb-8 pt-20 sm:px-6">
      <div className="w-full max-w-[760px]">
        <div className="mb-8 text-center sm:mb-10">
          <div className="mb-5 inline-flex items-center gap-3">
            <span className="portal-mark flex h-11 w-11 items-center justify-center rounded-2xl">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span className="text-xl font-extrabold tracking-tight text-white">ProofLine</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[30px]">
            Welcome to ProofLine
          </h1>
          <p className="mt-2 text-sm text-slate-400 sm:text-[15px]">
            Choose how you&apos;d like to continue.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4">
          <section className="access-option flex flex-col rounded-2xl p-5 sm:p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-white">Office Workspace</h2>
            <p className="mt-1.5 min-h-10 text-[13px] leading-relaxed text-slate-400">
              Sign in to your authorized ProofLine workspace.
            </p>
            <button
              type="button"
              onClick={() => navigate('/office/login')}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Continue to Office
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </section>

          <section className="access-option flex flex-col rounded-2xl p-5 sm:p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/10 text-slate-400">
              <ScanText className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-white">Guest Workspace</h2>
            <p className="mt-1.5 min-h-10 text-[13px] leading-relaxed text-slate-400">
              Check a claim against a reference fact you provide.
            </p>
            <button
              type="button"
              onClick={() => navigate('/guest')}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Continue as Guest
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </section>
        </div>
        {evaluationStatus !== 'disabled' && (
          <section className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-800/80 bg-slate-950/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800/70 text-slate-300">
                <KeyRound className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-xs font-semibold text-slate-200">Evaluation Access</h2>
                {evaluationStatus === 'enabled' && <p className="mt-0.5 text-[11px] text-slate-500">Explore the public demonstration workspaces.</p>}
                {evaluationStatus === 'checking' && <p className="mt-0.5 text-[11px] text-slate-500">Checking demo availability…</p>}
                {evaluationStatus === 'error' && <p role="alert" className="mt-0.5 text-[11px] text-rose-300">{evaluationError}</p>}
              </div>
            </div>
            {evaluationStatus === 'enabled' && (
              <button
                type="button"
                onClick={() => navigate('/evaluation/workspaces')}
                className="min-h-9 rounded-lg border border-slate-700 px-3.5 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800/60 hover:text-white"
              >
                Access Demo Workspace
              </button>
            )}
            {evaluationStatus === 'error' && (
              <button type="button" onClick={retryEvaluationCheck} className="min-h-9 rounded-lg border border-slate-700 px-3.5 text-xs font-semibold text-slate-300 hover:bg-slate-800/60">
                Retry
              </button>
            )}
          </section>
        )}
        <p className="mt-6 text-center text-[11px] tracking-wide text-slate-500">
          Evidence-backed claim review · Change-impact intelligence
        </p>
      </div>
    </main>
  );
};
