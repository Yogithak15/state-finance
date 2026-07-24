import React, { useState } from 'react';
import { SDP_TABS, SdpTabId } from './sdpTabs';
import SdpTabsNav from './SdpTabsNav';
import SdpComingSoon from './SdpComingSoon';
import IncomeTrendsChart from './IncomeTrendsChart';
import StateRankingsChart from './StateRankingsChart';
import GrowthLeagueChart from './GrowthLeagueChart';
import EconomicWeightChart from './EconomicWeightChart';
import RealVsNominalChart from './RealVsNominalChart';
import GrowthHeatmapChart from './GrowthHeatmapChart';
import GrowthVsProsperityChart from './GrowthVsProsperityChart';

const TAB_CONTENT: Partial<Record<SdpTabId, React.FC>> = {
  'income-trends': IncomeTrendsChart,
  'state-rankings': StateRankingsChart,
  'growth-league': GrowthLeagueChart,
  'economic-weight': EconomicWeightChart,
  'real-vs-nominal': RealVsNominalChart,
  'growth-heatmap': GrowthHeatmapChart,
  'growth-vs-prosperity': GrowthVsProsperityChart,
};

const SdpSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SdpTabId>('income-trends');
  const tab = SDP_TABS.find((t) => t.id === activeTab) ?? SDP_TABS[0];
  const Content = TAB_CONTENT[activeTab];

  return (
    <div className="sdp-section">
      <SdpTabsNav activeTab={activeTab} onSelectTab={setActiveTab} />
      {Content ? <Content /> : <SdpComingSoon tab={tab} />}
    </div>
  );
};

export default SdpSection;
