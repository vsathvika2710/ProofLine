import React from 'react';
import {
  Zap,
  Database,
  ScanText,
  UserCheck2,
  BarChart3,
  Award,
  Globe,
  Activity,
  Layers,
} from 'lucide-react';

export type TabType = 'landing' | 'impact' | 'vault' | 'reviewer' | 'review_center' | 'analytics' | 'dossier';

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  pendingTasksCount: number;
  factsCount: number;
  activeOfficeRole?: 'creator' | 'reviewer' | 'admin';
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  pendingTasksCount,
  factsCount,
  activeOfficeRole = 'creator',
}) => {
  const navItems: {
    id: TabType;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    badge?: string | number;
    badgeColor?: string;
    highlight?: boolean;
  }[] = [
    {
      id: 'landing',
      label: 'Product Overview',
      sublabel: 'Mission, Story & Capabilities',
      icon: <Globe className="w-4 h-4 text-sky-400" />,
    },
    {
      id: 'impact',
      label: 'Change Impact Engine',
      sublabel: 'Signature Cascade Intelligence',
      icon: <Zap className="w-4 h-4 text-amber-400" />,
      badge: 'SIGNATURE',
      badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono',
      highlight: true,
    },
    {
      id: 'vault',
      label: 'Evidence Vault',
      sublabel: 'Truth Source & Verified Docs',
      icon: <Database className="w-4 h-4 text-cyan-400" />,
      badge: factsCount,
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono',
    },
    {
      id: 'reviewer',
      label: 'Content Scanner & Claims',
      sublabel: 'Pre-Publication Validation',
      icon: <ScanText className="w-4 h-4 text-blue-400" />,
    },
    {
      id: 'review_center',
      label: 'Human Review Centre',
      sublabel: 'Collaborate & Approvals',
      icon: <UserCheck2 className="w-4 h-4 text-purple-400" />,
      badge: pendingTasksCount > 0 ? `${pendingTasksCount} Action` : undefined,
      badgeColor: 'bg-red-500/20 text-red-300 border border-red-500/40 font-bold font-mono animate-pulse',
    },
    {
      id: 'analytics',
      label: 'Governance Analytics',
      sublabel: 'Health & Recurring Risks',
      icon: <BarChart3 className="w-4 h-4 text-emerald-400" />,
    },
    {
      id: 'dossier',
      label: 'Round 2 Dossier',
      sublabel: 'Architecture & Submission Pack',
      icon: <Award className="w-4 h-4 text-orange-400" />,
      badge: '100 Pts',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono',
    },
  ];

  return (
    <aside className="w-full md:w-64 lg:w-72 border-r border-white/[0.08] bg-[#070a13]/95 backdrop-blur-xl flex flex-col justify-between shrink-0">
      <div className="p-3.5 space-y-1.5">
        <div className="px-3 py-2 text-[10px] font-bold tracking-wider uppercase text-slate-500 font-mono flex items-center justify-between">
          <span>Platform Modules</span>
          <span className="text-cyan-400/80">v2.0</span>
        </div>

        {navItems.filter((item) => {
          if (activeOfficeRole === 'creator') {
            return ['landing', 'reviewer'].includes(item.id);
          }
          if (activeOfficeRole === 'reviewer') {
            return ['landing', 'vault', 'review_center'].includes(item.id);
          }
          return true;
        }).map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full text-left px-3.5 py-3 rounded-2xl transition-all duration-200 flex items-center justify-between group ${
                isActive
                  ? 'bg-gradient-to-r from-slate-800 to-slate-850 text-white shadow-xl shadow-black/40 border border-white/10 ring-1 ring-white/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
              } ${item.highlight && !isActive ? 'hover:border-amber-500/30' : ''}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`p-2 rounded-xl transition-transform group-hover:scale-105 ${
                    isActive ? 'bg-slate-900 shadow-inner' : 'bg-slate-900/50'
                  }`}
                >
                  {item.icon}
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold tracking-tight truncate flex items-center gap-1.5">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5 font-normal">
                    {item.sublabel}
                  </div>
                </div>
              </div>

              {item.badge && (
                <span
                  className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Status Card */}
      <div className="p-3.5 m-3.5 rounded-2xl bg-gradient-to-b from-[#0d1222] to-[#080c16] border border-white/[0.08] text-xs space-y-2 shadow-xl">
        <div className="flex items-center justify-between text-slate-400">
          <span className="font-mono text-[10px] flex items-center gap-1.5 text-slate-300">
            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            Active Engine Status
          </span>
          <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            ONLINE
          </span>
        </div>
        <div className="text-[11px] text-slate-400 leading-relaxed">
          Evidence Vault synchronized. Exact-citation claim matcher active with zero ungrounded drift.
        </div>
      </div>
    </aside>
  );
};
