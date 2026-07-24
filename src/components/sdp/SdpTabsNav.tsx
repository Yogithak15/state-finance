import React from 'react';
import { SDP_TABS, SdpTabId } from './sdpTabs';
import './SdpTabsNav.css';

interface SdpTabsNavProps {
  activeTab: SdpTabId;
  onSelectTab: (id: SdpTabId) => void;
}

const SdpTabsNav: React.FC<SdpTabsNavProps> = ({ activeTab, onSelectTab }) => (
  <div className="sdp-tabs-nav" role="tablist">
    {SDP_TABS.map((tab) => (
      <button
        key={tab.id}
        type="button"
        role="tab"
        aria-selected={tab.id === activeTab}
        className={`sdp-tab${tab.id === activeTab ? ' active' : ''}`}
        onClick={() => onSelectTab(tab.id)}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

export default SdpTabsNav;
