import React, { useState } from 'react';
import { FISCAL_TABS, FiscalTabId } from './fiscalTabs';
import FiscalTabsNav from './FiscalTabsNav';
import FiscalComingSoon from './FiscalComingSoon';
import DeficitTrendsChart from './DeficitTrendsChart';
import DeficitGsdpChart from './DeficitGsdpChart';
import FiscalStateRankingsChart from './FiscalStateRankingsChart';
import RevenueSpendingMixChart from './RevenueSpendingMixChart';
import DebtLiabilitiesChart from './DebtLiabilitiesChart';
import BorrowingsGuaranteesChart from './BorrowingsGuaranteesChart';
import FiscalStressMapChart from './FiscalStressMapChart';

const TAB_CONTENT: Partial<Record<FiscalTabId, React.FC>> = {
  'deficit-trends': DeficitTrendsChart,
  'deficit-gsdp': DeficitGsdpChart,
  'state-rankings': FiscalStateRankingsChart,
  'revenue-spending-mix': RevenueSpendingMixChart,
  'debt-liabilities': DebtLiabilitiesChart,
  'borrowings-guarantees': BorrowingsGuaranteesChart,
  'fiscal-stress-map': FiscalStressMapChart,
};

const FiscalSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FiscalTabId>('deficit-trends');
  const tab = FISCAL_TABS.find((t) => t.id === activeTab) ?? FISCAL_TABS[0];
  const Content = TAB_CONTENT[activeTab];

  return (
    <div className="fiscal-section">
      <FiscalTabsNav activeTab={activeTab} onSelectTab={setActiveTab} />
      {Content ? <Content /> : <FiscalComingSoon tab={tab} />}
    </div>
  );
};

export default FiscalSection;
