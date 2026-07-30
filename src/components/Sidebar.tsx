import React from 'react';
import { CATEGORIES, CategoryId } from '../types';
import { CATEGORY_ICONS, LogoMark, CloseIcon } from './icons';
import './Sidebar.css';

interface SidebarProps {
  activeCategory: CategoryId;
  onSelectCategory: (id: CategoryId) => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeCategory, onSelectCategory, isOpen, onClose }) => {
  return (
    <>
      <div
        className={`sidebar-overlay${isOpen ? ' visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`sidebar${isOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <span className="sidebar-brand-icon">
            <LogoMark width={22} height={22} />
          </span>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-title">State Finance</span>
            <span className="sidebar-brand-subtitle">Dashboard</span>
          </div>
          <button
            type="button"
            className="sidebar-close"
            onClick={onClose}
            aria-label="Close menu"
          >
            <CloseIcon width={18} height={18} />
          </button>
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
                    onClick={() => {
                      onSelectCategory(category.id);
                      onClose();
                    }}
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
          <span>Data is up to date</span>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
