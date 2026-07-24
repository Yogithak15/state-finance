import React, { useState } from 'react';
import { PRICE_WAGES_TABS, PriceWagesTabId } from './priceWagesTabs';
import PriceWagesTabsNav from './PriceWagesTabsNav';
import PriceWagesComingSoon from './PriceWagesComingSoon';
import InflationTrendsChart from './InflationTrendsChart';
import PwStateRankingsChart from './PwStateRankingsChart';
import PwInflationHeatmapChart from './PwInflationHeatmapChart';
import PwInflationVsGrowthChart from './PwInflationVsGrowthChart';
import InflationByCategoryChart from './InflationByCategoryChart';
import RuralWageRatesChart from './RuralWageRatesChart';

const TAB_CONTENT: Partial<Record<PriceWagesTabId, React.FC>> = {
  'inflation-trends': InflationTrendsChart,
  'state-rankings': PwStateRankingsChart,
  'inflation-heatmap': PwInflationHeatmapChart,
  'inflation-vs-growth': PwInflationVsGrowthChart,
  'inflation-by-category': InflationByCategoryChart,
  'rural-wage-rates': RuralWageRatesChart,
};

const PriceWagesSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PriceWagesTabId>('inflation-trends');
  const tab = PRICE_WAGES_TABS.find((t) => t.id === activeTab) ?? PRICE_WAGES_TABS[0];
  const Content = TAB_CONTENT[activeTab];

  return (
    <div className="pw-section">
      <PriceWagesTabsNav activeTab={activeTab} onSelectTab={setActiveTab} />
      {Content ? <Content /> : <PriceWagesComingSoon tab={tab} />}
    </div>
  );
};

export default PriceWagesSection;
