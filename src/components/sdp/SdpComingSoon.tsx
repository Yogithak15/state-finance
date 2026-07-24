import React from 'react';
import { SdpTab } from './sdpTabs';
import './SdpComingSoon.css';

interface SdpComingSoonProps {
  tab: SdpTab;
}

const SdpComingSoon: React.FC<SdpComingSoonProps> = ({ tab }) => (
  <div className="sdp-coming-soon">
    <span className="sdp-coming-soon-label">{tab.label}</span>
    <span className="sdp-coming-soon-hint">Chart coming soon</span>
  </div>
);

export default SdpComingSoon;
