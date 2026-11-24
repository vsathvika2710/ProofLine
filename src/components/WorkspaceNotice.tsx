import React from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

type WorkspaceNoticeProps = {
  tone: 'info' | 'warning' | 'critical';
  children: React.ReactNode;
  action?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
};

const toneClasses = {
  info: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100',
  warning: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
  critical: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100',
};

export const WorkspaceNotice: React.FC<WorkspaceNoticeProps> = ({
  tone,
  children,
  action,
  onDismiss,
  className = '',
}) => {
  const Icon = tone === 'info' ? Info : AlertTriangle;

  return (
    <div
      role={tone === 'info' ? 'status' : 'alert'}
      aria-live={tone === 'info' ? 'polite' : 'assertive'}
      className={`flex flex-wrap items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs leading-relaxed sm:text-sm ${toneClasses[tone]} ${className}`}
    >
      <Icon size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="ml-6 flex shrink-0 items-center gap-2 sm:ml-0">{action}</div>}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="rounded p-1 opacity-70 hover:bg-black/5 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 dark:hover:bg-white/10"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
};
