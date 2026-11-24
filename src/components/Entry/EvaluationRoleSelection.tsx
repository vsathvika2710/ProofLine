import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, FilePenLine, ShieldCheck } from 'lucide-react';
import { checkEvaluationAccess } from '../../services/evaluationAccess';
type EvaluationRole = 'creator' | 'reviewer' | 'admin';

const cards: Array<{ role: EvaluationRole; title: string; description: string; button: string; icon: React.ReactNode }> = [
  { role: 'admin', title: 'Admin', description: 'Explore governance, approved evidence, analytics and change impact.', button: 'Explore Admin', icon: <ShieldCheck className="h-5 w-5" /> },
  { role: 'creator', title: 'Content Creator', description: 'Create demonstration content, analyze claims and submit for review.', button: 'Explore Creator', icon: <FilePenLine className="h-5 w-5" /> },
  { role: 'reviewer', title: 'Reviewer', description: 'Inspect demonstration submissions, evidence and review decisions.', button: 'Explore Reviewer', icon: <ClipboardCheck className="h-5 w-5" /> },
];

export const EvaluationRoleSelection: React.FC = () => {
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const retry = () => {
    setEnabled(null);
    setError('');
    setAttempt((value) => value + 1);
  };

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void checkEvaluationAccess(controller.signal)
      .then((isEnabled) => {
        if (!active) return;
        if (!isEnabled) {
          navigate('/', { replace: true });
          return;
        }
        setEnabled(true);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setEnabled(false);
        setError(cause instanceof Error ? cause.message : 'Could not check demo availability. Retry the request.');
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt, navigate]);

  const choose = (role: EvaluationRole) => {
    navigate(`/evaluation/dashboard/${role}`);
  };

  if (error) {
    return (
      <main className="entry-main flex min-h-screen items-center justify-center px-4">
        <section className="portal-panel max-w-lg rounded-2xl p-8 text-center" role="alert">
          <h1 className="text-xl font-bold text-white">Could not check demo availability</h1>
          <p className="mt-2 text-sm text-slate-400">{error}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={retry} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              Retry
            </button>
            <button type="button" onClick={() => navigate('/')} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300">
              Return home
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (enabled !== true) {
    return <main className="entry-main flex min-h-screen items-center justify-center text-sm text-slate-400">Checking demo availability…</main>;
  }

  return (
    <main className="entry-main min-h-screen px-4 pb-10 pt-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <span className="portal-mark mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl"><ShieldCheck className="h-5 w-5" /></span>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Explore ProofLine</h1>
          <p className="mt-2 text-sm text-slate-400">Choose a workspace to experience the brand governance workflow.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <section key={card.role} className="access-option flex min-h-64 flex-col rounded-2xl p-6">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">{card.icon}</div>
              <h2 className="text-lg font-semibold text-white">{card.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{card.description}</p>
              <button type="button" onClick={() => choose(card.role)} className="mt-6 min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500">{card.button}</button>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
};
