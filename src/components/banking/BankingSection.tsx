import React, { useState } from 'react';
import { BANKING_TABS, BankingTabId } from './bankingTabs';
import BankingTabsNav from './BankingTabsNav';
import BankingComingSoon from './BankingComingSoon';
import DepositsCreditTrendChart from './DepositsCreditTrendChart';
import CreditDepositRatioChart from './CreditDepositRatioChart';
import BankingStateRankingsChart from './BankingStateRankingsChart';
import CreditMixChart from './CreditMixChart';
import BankingPenetrationChart from './BankingPenetrationChart';
import RuralVsUrbanReachChart from './RuralVsUrbanReachChart';

const TAB_CONTENT: Partial<Record<BankingTabId, React.FC>> = {
  'deposits-credit-trend': DepositsCreditTrendChart,
  'credit-deposit-ratio': CreditDepositRatioChart,
  'state-rankings': BankingStateRankingsChart,
  'credit-mix': CreditMixChart,
  'banking-penetration': BankingPenetrationChart,
  'rural-vs-urban-reach': RuralVsUrbanReachChart,
};

const BankingSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<BankingTabId>('deposits-credit-trend');
  const tab = BANKING_TABS.find((t) => t.id === activeTab) ?? BANKING_TABS[0];
  const Content = TAB_CONTENT[activeTab];

  return (
    <div className="banking-section">
      <BankingTabsNav activeTab={activeTab} onSelectTab={setActiveTab} />
      {Content ? <Content /> : <BankingComingSoon tab={tab} />}
    </div>
  );
};

export default BankingSection;
