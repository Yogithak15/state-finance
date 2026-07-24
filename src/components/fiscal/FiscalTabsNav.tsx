import React from 'react';
import { FISCAL_TABS, FiscalTabId } from './fiscalTabs';
import './FiscalTabsNav.css';

interface FiscalTabsNavProps {
  activeTab: FiscalTabId;
  onSelectTab: (id: FiscalTabId) => void;
}

const FiscalTabsNav: React.FC<FiscalTabsNavProps> = ({ activeTab, onSelectTab }) => (
  <div className="fiscal-tabs-nav" role="tablist">
    {FISCAL_TABS.map((tab) => (
      <button
        key={tab.id}
        type="button"
        role="tab"
        aria-selected={tab.id === activeTab}
        className={`fiscal-tab${tab.id === activeTab ? ' active' : ''}`}
        onClick={() => onSelectTab(tab.id)}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

export default FiscalTabsNav;
