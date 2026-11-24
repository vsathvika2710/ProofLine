import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, FileText, Settings, ShieldCheck } from 'lucide-react';
import { ThemeSelector } from '../ThemeSelector';
import {
  getOfficeSession,
  getWorkspace,
  OfficeRole,
  officeSignOut,
  selectOfficeWorkspace,
  WorkspaceAuthorization,
} from '../../services/officeAuth';

const roleCards: Array<{
  role: OfficeRole;
  title: string;
  description: string;
  button: string;
  icon: React.ReactNode;
}> = [
  {
    role: 'creator',
    title: 'Content Creator Dashboard',
    description: 'Create content, verify claims and submit content for review.',
    button: 'Open Creator Workspace',
    icon: <FileText className="h-5 w-5" />,
  },
  {
    role: 'reviewer',
    title: 'Reviewer Dashboard',
    description: 'Inspect claims, compare evidence and manage approval decisions.',
    button: 'Open Reviewer Workspace',
    icon: <ClipboardCheck className="h-5 w-5" />,
  },
  {
    role: 'admin',
    title: 'Admin Dashboard',
    description: 'Manage approved evidence, brand governance, policies and change impact analysis.',
    button: 'Open Admin Workspace',
    icon: <Settings className="h-5 w-5" />,
  },
];

export const RoleSelection: React.FC = () => {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<WorkspaceAuthorization | null>(null);
  const [authenticatedEmail, setAuthenticatedEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await getOfficeSession();
        if (!session) {
          navigate('/office/login', { replace: true });
          return;
        }
        const resolved = await getWorkspace(session);
        if (!active) return;
        setAuthenticatedEmail(session.user.email || '');
        if (resolved.accountType === 'judge_demo') {
          throw new Error('Evaluation accounts must use the separate Evaluation Access flow.');
        }
        if (!resolved.requiresRoleSelection && resolved.assignedRole) {
          navigate(`/office/dashboard/${resolved.assignedRole}`, { replace: true });
          return;
        }
        setWorkspace(resolved);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Office access could not be verified.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [navigate]);

  const chooseRole = async (role: OfficeRole) => {
    setError('');
    const session = await getOfficeSession();
    if (!session) {
      navigate('/office/login', { replace: true });
      return;
    }
    try {
      await selectOfficeWorkspace(session, role);
      navigate(`/office/dashboard/${role}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This role is not authorized.');
    }
  };

  const handleSignOut = async () => {
    try {
      await officeSignOut();
      navigate('/', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign out securely.');
    }
  };

  return (
    <main className="entry-main min-h-screen px-4 pb-10 pt-8 sm:pt-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2.5">
            <span className="portal-mark flex h-10 w-10 items-center justify-center rounded-xl"><ShieldCheck className="h-5 w-5" /></span>
            <span className="text-lg font-extrabold tracking-tight text-white">ProofLine</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSelector compact />
            <button type="button" onClick={() => void handleSignOut()} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800">Sign out</button>
          </div>
        </header>
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Select your workspace</h1>
          <p className="mt-2 text-sm text-slate-400">Choose a workspace to continue.</p>
          {authenticatedEmail && <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300">
            <span>{authenticatedEmail}</span>
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 font-semibold text-blue-300">{workspace?.accountType === 'super_admin' ? 'Super Admin' : 'Authorized employee'}</span>
          </div>}
        </div>
        {loading && <p className="py-8 text-center text-sm text-slate-400">Loading authorized workspaces…</p>}
        {error && <p role="alert" className="form-error mx-auto mb-5 max-w-xl rounded-lg px-4 py-3 text-sm">{error}</p>}
        {!loading && workspace && <div className="grid gap-4 md:grid-cols-3">
          {roleCards
            .filter((card) => workspace?.availableRoles.includes(card.role))
            .map((card) => (
              <section key={card.role} className="access-option flex min-h-64 flex-col rounded-2xl p-6">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                  {card.icon}
                </div>
                <h2 className="text-lg font-semibold text-white">{card.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{card.description}</p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void chooseRole(card.role)}
                  className="mt-6 min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500"
                >
                  {card.button}
                </button>
              </section>
            ))}
        </div>}
      </div>
    </main>
  );
};
