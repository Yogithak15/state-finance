import React from 'react';
import { BankingTab } from './bankingTabs';
import './BankingComingSoon.css';

interface BankingComingSoonProps {
  tab: BankingTab;
}

const BankingComingSoon: React.FC<BankingComingSoonProps> = ({ tab }) => (
  <div className="banking-coming-soon">
    <span className="banking-coming-soon-label">{tab.label}</span>
    <span className="banking-coming-soon-hint">Chart coming soon</span>
  </div>
);

export default BankingComingSoon;
