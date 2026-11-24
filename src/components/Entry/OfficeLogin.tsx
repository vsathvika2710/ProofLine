import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { getWorkspace, loginOffice } from '../../services/officeAuth';

export const OfficeLogin: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('proofline.office@gmail.com');
  const [password, setPassword] = useState('ProofLine@2026');

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const session = await loginOffice(email, password);
      const workspace = await getWorkspace(session);

      if (workspace.accountType === 'judge_demo') {
        throw new Error('Use Evaluation Access for demonstration workspaces.');
      }

      if (workspace.requiresRoleSelection) {
        navigate('/office/roles', { replace: true });
        return;
      }

      if (!workspace.assignedRole) {
        throw new Error('No workspace is assigned to this account.');
      }

      navigate(`/office/dashboard/${workspace.assignedRole}`, {
        replace: true
      });

    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Invalid email or password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="entry-main flex min-h-screen items-center justify-center px-4 pb-8 pt-20">
      <div className="w-full max-w-[400px]">

        <section className="portal-panel rounded-2xl p-6 sm:p-8">

          <div className="mb-6 text-center">

            <div className="mb-4 inline-flex items-center gap-2.5">

              <span className="portal-mark flex h-10 w-10 items-center justify-center rounded-xl">
                <ShieldCheck className="h-5 w-5" />
              </span>

              <span className="text-lg font-extrabold tracking-tight text-white">
                ProofLine
              </span>

            </div>

            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Office Workspace sign in
            </h1>

            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Sign in with your authorized ProofLine account.
            </p>

          </div>

          <form
            className="space-y-4"
            onSubmit={(event) => void handleSubmit(event)}
          >

            <div>
              <label
                htmlFor="office-email"
                className="mb-2 block text-xs font-semibold text-slate-300"
              >
                Email address
              </label>

              <input
                id="office-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                placeholder="name@organization.com"
                required
                maxLength={254}
                className="entry-field w-full rounded-xl px-3.5 py-3 text-sm outline-none transition focus:border-blue-500"
              />
            </div>

            <div>

              <label
                htmlFor="office-password"
                className="mb-2 block text-xs font-semibold text-slate-300"
              >
                Password
              </label>

              <div className="relative">

                <input
                  id="office-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  maxLength={1024}
                  className="entry-field w-full rounded-xl px-3.5 py-3 pr-12 text-sm outline-none transition focus:border-blue-500"
                />

                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-xl text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>

              </div>

            </div>

            {error && (
              <p
                role="alert"
                className="form-error rounded-lg px-3 py-2 text-xs"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>

          </form>

        </section>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="mx-auto mt-5 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />
          Back to homepage
        </button>

      </div>
    </main>
  );
};