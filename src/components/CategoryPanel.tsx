import React from 'react';
import { Category } from '../types';
import { CATEGORY_ICONS } from './icons';
import SdpStats, { SdpSummaryStats } from './SdpStats';
import SdpSection from './sdp/SdpSection';
import PriceWagesSection from './priceWages/PriceWagesSection';
import PriceWagesStats, { PwSummaryStats } from './priceWages/PriceWagesStats';
import BankingStats, { BankingSummaryStats } from './banking/BankingStats';
import BankingSection from './banking/BankingSection';
import FiscalKeyMetrics from './fiscal/FiscalKeyMetrics';
import FiscalSection from './fiscal/FiscalSection';
import StateProfilePage from './stateProfile/StateProfilePage';
import CompareStatesPage from './compareStates/CompareStatesPage';
import './CategoryPanel.css';

interface CategoryPanelProps {
  category: Category;
  sdpStats?: SdpSummaryStats | null;
  sdpError?: string | null;
  pwStats?: PwSummaryStats | null;
  pwError?: string | null;
  bankingStats?: BankingSummaryStats | null;
  bankingError?: string | null;
}

const PLACEHOLDER_SLOTS = [
  { size: 'wide', label: 'Trend overview' },
  { size: 'narrow', label: 'Key breakdown' },
  { size: 'narrow', label: 'Comparison' },
  { size: 'wide', label: 'Detailed view' },
];

const CategoryPanel: React.FC<CategoryPanelProps> = ({
  category,
  sdpStats,
  sdpError,
  pwStats,
  pwError,
  bankingStats,
  bankingError,
}) => {
  const Icon = CATEGORY_ICONS[category.id];

  return (
    <div className="category-panel">
      {category.id === 'sdp' && (
        <>
          <SdpStats stats={sdpStats ?? null} error={sdpError ?? null} />
          <SdpSection />
        </>
      )}
      {category.id === 'prices-wages' && (
        <>
          <PriceWagesStats stats={pwStats ?? null} error={pwError ?? null} />
          <PriceWagesSection />
        </>
      )}
      {category.id === 'banking' && (
        <>
          <BankingStats stats={bankingStats ?? null} error={bankingError ?? null} />
          <BankingSection />
        </>
      )}
      {category.id === 'fiscal' && (
        <>
          <FiscalKeyMetrics />
          <FiscalSection />
        </>
      )}
      {category.id === 'state-profile' && <StateProfilePage />}
      {category.id === 'compare-states' && <CompareStatesPage />}
      {category.id !== 'sdp' &&
        category.id !== 'prices-wages' &&
        category.id !== 'banking' &&
        category.id !== 'fiscal' &&
        category.id !== 'state-profile' &&
        category.id !== 'compare-states' && (
        <div className="category-grid">
          {PLACEHOLDER_SLOTS.map((slot, index) => (
            <div
              key={index}
              className={`category-slot ${slot.size === 'wide' ? 'span-2' : ''}`}
            >
              <div className="category-slot-icon">
                <Icon width={26} height={26} />
              </div>
              <span className="category-slot-label">{slot.label}</span>
              <span className="category-slot-hint">Chart coming soon</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryPanel;
