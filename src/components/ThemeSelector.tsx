import React from 'react';
import { Palette } from 'lucide-react';
import { useTheme } from '../theme/useTheme';

interface ThemeSelectorProps {
  compact?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ compact = false }) => {
  const { theme, setTheme } = useTheme();

  return (
    <label className="inline-flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/80 px-2.5 py-1.5 text-slate-300 shadow-sm transition-colors">
      <Palette aria-hidden="true" className="h-4 w-4 shrink-0 text-blue-400" />
      <span className={compact ? 'sr-only' : 'text-[11px] font-semibold whitespace-nowrap'}>
        Theme
      </span>
      <select
        aria-label="Color theme"
        value={theme}
        onChange={(event) => {
          const nextTheme = event.target.value;
          if (nextTheme === 'dark-enterprise' || nextTheme === 'minimal-professional') {
            setTheme(nextTheme);
          }
        }}
        className="max-w-[132px] cursor-pointer bg-transparent text-[11px] font-semibold text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-md"
      >
        <option value="dark-enterprise">Dark Enterprise</option>
        <option value="minimal-professional">Minimal Professional</option>
      </select>
    </label>
  );
};
