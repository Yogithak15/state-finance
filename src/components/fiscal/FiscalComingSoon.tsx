import React from 'react';
import { FiscalTab } from './fiscalTabs';
import './FiscalComingSoon.css';

interface FiscalComingSoonProps {
  tab: FiscalTab;
}

const FiscalComingSoon: React.FC<FiscalComingSoonProps> = ({ tab }) => (
  <div className="fiscal-coming-soon">
    <span className="fiscal-coming-soon-label">{tab.label}</span>
    <span className="fiscal-coming-soon-hint">Chart coming soon</span>
  </div>
);

export default FiscalComingSoon;
