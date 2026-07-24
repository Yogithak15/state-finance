import React from 'react';
import { BANKING_TABS, BankingTabId } from './bankingTabs';
import './BankingTabsNav.css';

interface BankingTabsNavProps {
  activeTab: BankingTabId;
  onSelectTab: (id: BankingTabId) => void;
}

const BankingTabsNav: React.FC<BankingTabsNavProps> = ({ activeTab, onSelectTab }) => (
  <div className="banking-tabs-nav" role="tablist">
    {BANKING_TABS.map((tab) => (
      <button
        key={tab.id}
        type="button"
        role="tab"
        aria-selected={tab.id === activeTab}
        className={`banking-tab${tab.id === activeTab ? ' active' : ''}`}
        onClick={() => onSelectTab(tab.id)}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

export default BankingTabsNav;
