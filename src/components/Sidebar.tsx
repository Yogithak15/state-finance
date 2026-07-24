import React from 'react';
import { CATEGORIES, CategoryId } from '../types';
import { CATEGORY_ICONS, LogoMark } from './icons';
import './Sidebar.css';

interface SidebarProps {
  activeCategory: CategoryId;
  onSelectCategory: (id: CategoryId) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeCategory, onSelectCategory }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-icon">
          <LogoMark width={22} height={22} />
        </span>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-title">State Finance</span>
          <span className="sidebar-brand-subtitle">Dashboard</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <span className="sidebar-nav-label">Categories</span>
        <ul>
          {CATEGORIES.map((category) => {
            const Icon = CATEGORY_ICONS[category.id];
            const isActive = category.id === activeCategory;
            return (
              <li key={category.id}>
                <button
                  type="button"
                  className={`sidebar-nav-item${isActive ? ' active' : ''}`}
                  onClick={() => onSelectCategory(category.id)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="sidebar-nav-icon">
                    <Icon />
                  </span>
                  <span>{category.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-footer-dot" />
        <span>Data last refreshed manually</span>
      </div>
    </aside>
  );
};

export default Sidebar;
