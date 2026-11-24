import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';

export type OfficeRole = 'creator' | 'reviewer' | 'admin';

export interface WorkspaceAuthorization {
  accountType: 'employee' | 'super_admin' | 'judge_demo';
  organizationId: string | null;
  assignedRole: OfficeRole | null;
  availableRoles: OfficeRole[];
  requiresRoleSelection: boolean;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export async function loginOffice(email: string, password: string): Promise<Session> {
  if (!supabase) throw new Error('Office sign-in is not configured.');
  let response: Response;
  try {
    response = await fetch(`${officeApiBase()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
  } catch {
    throw new Error('Could not reach the Office sign-in service. Check the connection and try again.');
  }
  const body = await response.json().catch(() => null) as
    | { detail?: string; access_token?: string; refresh_token?: string }
    | null;
  if (!response.ok) {
    if (response.status === 401) throw new Error('Invalid email or password.');
    if (response.status === 429) throw new Error('Too many sign-in attempts. Try again later.');
    throw new Error(body?.detail || 'Office sign-in is unavailable. Try again later.');
  }
  if (!body?.access_token || !body.refresh_token) {
    throw new Error('The Office sign-in service returned an invalid session.');
  }
  const { data, error } = await supabase.auth.setSession({
    access_token: body.access_token,
    refresh_token: body.refresh_token,
  });
  if (error || !data.session) throw error || new Error('The authenticated session could not be established.');
  return data.session;
}

export async function getOfficeSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getWorkspace(session: Session, activeRole?: OfficeRole): Promise<WorkspaceAuthorization> {
  const headers: Record<string, string> = { Authorization: `Bearer ${session.access_token}` };
  if (activeRole) headers['X-Proofline-Active-Role'] = activeRole;
  const response = await fetch(`${officeApiBase()}/api/auth/workspace`, {
    headers,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || 'Office access could not be verified.');
  }
  return response.json();
}

export async function selectOfficeWorkspace(session: Session, role: OfficeRole): Promise<void> {
  const response = await fetch(`${officeApiBase()}/api/auth/workspace/select-role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || 'That role is not authorized.');
  }
}

export async function officeSignOut(): Promise<void> {
  if (!supabase) return;
  const session = await getOfficeSession();
  let backendFailure: Error | undefined;
  if (session) {
    try {
      const response = await fetch(`${officeApiBase()}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok && response.status !== 401) {
        backendFailure = new Error('The Office session could not be invalidated on the server.');
      }
    } catch {
      backendFailure = new Error('The Office session could not be invalidated on the server.');
    }
  }
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (backendFailure) throw backendFailure;
  if (error) throw error;
}

export function officeApiBase(): string {
  if (import.meta.env.DEV) return '';
  return ((import.meta.env.VITE_API_BASE_URL as string | undefined) || '').replace(/\/+$/, '');
}
