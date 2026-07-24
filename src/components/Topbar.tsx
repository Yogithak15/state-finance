import React from 'react';
import { Category } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { SunIcon, MoonIcon } from './icons';
import './Topbar.css';

interface TopbarProps {
  category: Category;
}

const Topbar: React.FC<TopbarProps> = ({ category }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="topbar">
      <div>
        <div className="topbar-breadcrumb">Dashboard / {category.shortLabel}</div>
        <h1 className="topbar-title">{category.label}</h1>
      </div>
      <div className="topbar-actions">
        <button
          type="button"
          className="topbar-theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        >
          {theme === 'light' ? <MoonIcon width={17} height={17} /> : <SunIcon width={17} height={17} />}
        </button>
      </div>
    </header>
  );
};

export default Topbar;
