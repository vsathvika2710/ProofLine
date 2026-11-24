import React from 'react';
import { ThemeSelector } from '../ThemeSelector';

export const EntryLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <div className="entry-shell min-h-screen">
      <div className="entry-theme-control fixed right-4 top-4 z-40 sm:right-6 sm:top-5">
          <ThemeSelector compact />
      </div>
      {children}
    </div>
  );
};
