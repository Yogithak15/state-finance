import React from 'react';
import { PriceWagesTab } from './priceWagesTabs';
import './PriceWagesComingSoon.css';

interface PriceWagesComingSoonProps {
  tab: PriceWagesTab;
}

const PriceWagesComingSoon: React.FC<PriceWagesComingSoonProps> = ({ tab }) => (
  <div className="pw-coming-soon">
    <span className="pw-coming-soon-label">{tab.label}</span>
    <span className="pw-coming-soon-hint">Chart coming soon</span>
  </div>
);

export default PriceWagesComingSoon;
