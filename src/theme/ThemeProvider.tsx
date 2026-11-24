import React, { useMemo, useState } from 'react';
import { ThemeContext } from './themeContext';
import { ThemeId } from './themeTypes';

const STORAGE_KEY = 'proofline-theme';
const DEFAULT_THEME: ThemeId = 'minimal-professional';

const isThemeId = (value: string | null): value is ThemeId =>
  value === 'dark-enterprise' || value === 'minimal-professional';

const readStoredTheme = (): ThemeId => {
  try {
    const storedTheme = window.localStorage.getItem(STORAGE_KEY);
    return isThemeId(storedTheme) ? storedTheme : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [theme, updateTheme] = useState<ThemeId>(readStoredTheme);

  const setTheme = (nextTheme: ThemeId) => {
    updateTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;

    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // The current selection still applies for this page when storage is unavailable.
    }
  };

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
