import React from 'react';
import {
  ShieldCheck,
  Zap,
  Sparkles,
  UserCheck,
  ChevronDown,
  CheckCircle2,
  FileText,
  Globe,
  Database,
  ScanText,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { UserRole } from '../types';
import { TabType } from './Sidebar';
import { ThemeSelector } from './ThemeSelector';

interface NavbarProps {
  currentScenario: string;
  onSelectScenario: (id: string) => void;
  activeRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenDossier: () => void;
  onStartTour: () => void;
  isJudgeDemo?: boolean;
  canSwitchWorkspace?: boolean;
  availableOfficeRoles?: Array<'creator' | 'reviewer' | 'admin'>;
  onSelectOfficeRole?: (role: 'creator' | 'reviewer' | 'admin') => void;
  onLogout?: () => void;
  publicDemo?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentScenario,
  onSelectScenario,
  activeRole,
  onSelectRole,
  activeTab,
  onSelectTab,
  onOpenDossier,
  onStartTour,
  isJudgeDemo = false,
  canSwitchWorkspace = false,
  availableOfficeRoles = [],
  onSelectOfficeRole,
  onLogout,
  publicDemo = false,
}) => {
  const roleLabels: Record<UserRole, { title: string; short: string; color: string }> = {
    legal_compliance: {
      title: 'Sarah Chen · Legal Director',
      short: 'Legal & Compliance',
      color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
    },
    brand_manager: {
      title: 'Liam Kelly · Brand Lead',
      short: 'Brand Manager',
      color: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10',
    },
    content_creator: {
      title: 'Chloe Taylor · Content Lead',
      short: 'Content Creator',
      color: 'border-purple-500/40 text-purple-400 bg-purple-500/10',
    },
    agency_reviewer: {
      title: 'External Agency Reviewer',
      short: 'Agency Partner',
      color: 'border-amber-500/40 text-amber-400 bg-amber-500/10',
    },
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#070912]/80 backdrop-blur-xl px-4 lg:px-8 py-3 transition-all">
      <div className="flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div
          onClick={() => onSelectTab('landing')}
          className="flex items-center gap-3 cursor-pointer group shrink-0"
        >
          <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 via-sky-600 to-blue-700 shadow-lg shadow-cyan-500/25 text-white font-bold group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight text-white font-sans">
                Proofline
              </span>
              <span className="text-[9px] uppercase tracking-wider font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                Inkloom AI Track
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden xl:block font-normal">
              When facts change, know exactly what needs to change.
            </p>
          </div>
        </div>

        {/* Central View Switcher (Landing vs Engine) */}
        <div className="hidden lg:flex items-center gap-1 bg-[#0f1424] p-1 rounded-2xl border border-white/[0.08] shadow-inner">
          <button
            onClick={() => onSelectTab('landing')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'landing'
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Product Overview</span>
          </button>

          {(!publicDemo || activeRole === 'brand_manager') && <button
            onClick={() => onSelectTab('impact')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'impact'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-amber-400" />
            <span>Change Impact Engine</span>
          </button>}

          {(!publicDemo || activeRole === 'brand_manager' || activeRole === 'legal_compliance') && <button
            onClick={() => onSelectTab('vault')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'vault'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-cyan-300'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Evidence Vault</span>
          </button>}

          {(!publicDemo || activeRole === 'content_creator') && <button
            onClick={() => onSelectTab('reviewer')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'reviewer'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'text-slate-400 hover:text-blue-300'
            }`}
          >
            <ScanText className="w-3.5 h-3.5" />
            <span>Scanner</span>
          </button>}

          {(!publicDemo || activeRole === 'brand_manager' || activeRole === 'legal_compliance') && <button
            onClick={() => onSelectTab('review_center')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'review_center'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-purple-300'
            }`}
          >
            <span>Review Queue</span>
          </button>}
        </div>

        {/* Right Actions Toolbar */}
        <div className="flex items-center gap-2.5">
          <ThemeSelector compact />

          {/* Dataset Switcher */}
          {!publicDemo && <div className="hidden sm:flex items-center gap-1 bg-slate-900/80 border border-white/[0.08] rounded-xl p-1 text-xs">
            <button
              onClick={() => onSelectScenario('smartwatch')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                currentScenario === 'smartwatch'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Test Hardware Warranty Case"
            >
              ⌚ SmartWatch X
            </button>
            <button
              onClick={() => onSelectScenario('foxtale')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                currentScenario === 'foxtale'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Test Foxtale Skincare Case (Slide 5)"
            >
              🧪 Foxtale
            </button>
          </div>}

          {/* Interactive Guided Tour */}
          <button
            onClick={onStartTour}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all shadow-md shadow-amber-950/20"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="hidden md:inline">2-Min Judge Tour</span>
            <span className="md:hidden">Tour</span>
          </button>

          {/* Workspace choices are constrained to roles returned by the authenticated backend. */}
          {isJudgeDemo ? (
            <div className="relative group">
              <button
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border ${roleLabels[activeRole].color}`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{publicDemo || canSwitchWorkspace ? 'Switch Workspace' : roleLabels[activeRole].short}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              <div className="absolute right-0 mt-1.5 w-56 bg-[#0d1222] border border-white/10 rounded-2xl shadow-2xl py-1.5 hidden group-hover:block z-50">
                <div className="px-3.5 py-1 text-[10px] uppercase font-bold text-slate-400">{publicDemo ? 'Demo workspaces' : 'Authorized workspaces'}</div>
                {availableOfficeRoles.map((role) => {
                  const legacyRole: UserRole =
                    role === 'creator' ? 'content_creator'
                      : role === 'admin' ? 'brand_manager'
                        : 'legal_compliance';
                  return (
                    <button
                      key={role}
                      onClick={() => onSelectOfficeRole?.(role)}
                      className={`w-full text-left px-3.5 py-2 text-xs hover:bg-slate-800/80 ${
                        activeRole === legacyRole ? 'text-cyan-400 font-bold' : 'text-slate-300'
                      }`}
                    >
                      {publicDemo
                        ? role === 'admin' ? 'Admin' : role === 'creator' ? 'Content Creator' : 'Reviewer'
                        : roleLabels[legacyRole].short}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : canSwitchWorkspace ? (
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300">
              <span className="hidden sm:inline">Switch Workspace</span>
              <select
                aria-label="Switch authorized Office workspace"
                value={activeRole === 'brand_manager' ? 'admin' : activeRole === 'content_creator' ? 'creator' : 'reviewer'}
                onChange={(event) => onSelectOfficeRole?.(event.target.value as 'creator' | 'reviewer' | 'admin')}
                className="max-w-36 cursor-pointer bg-transparent text-xs outline-none"
              >
                {availableOfficeRoles.map((role) => <option key={role} value={role}>{role === 'admin' ? 'Admin' : role === 'creator' ? 'Content Creator' : 'Reviewer'}</option>)}
              </select>
            </label>
          ) : (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border ${roleLabels[activeRole].color}`}>
              <UserCheck className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">{roleLabels[activeRole].title}</span>
              <span className="xl:hidden">{roleLabels[activeRole].short}</span>
            </div>
          )}

          {publicDemo && (
            <span className="hidden lg:inline-flex rounded-lg border border-slate-700 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Fictional Demo
            </span>
          )}

          {/* Round 2 Dossier Button */}
          <button
            onClick={onOpenDossier}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/40 transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">100 Pts Dossier</span>
            <span className="sm:hidden">Dossier</span>
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
