import React from 'react';
import { PRICE_WAGES_TABS, PriceWagesTabId } from './priceWagesTabs';
import './PriceWagesTabsNav.css';

interface PriceWagesTabsNavProps {
  activeTab: PriceWagesTabId;
  onSelectTab: (id: PriceWagesTabId) => void;
}

const PriceWagesTabsNav: React.FC<PriceWagesTabsNavProps> = ({ activeTab, onSelectTab }) => (
  <div className="pw-tabs-nav" role="tablist">
    {PRICE_WAGES_TABS.map((tab) => (
      <button
        key={tab.id}
        type="button"
        role="tab"
        aria-selected={tab.id === activeTab}
        className={`pw-tab${tab.id === activeTab ? ' active' : ''}`}
        onClick={() => onSelectTab(tab.id)}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

export default PriceWagesTabsNav;
