import React from 'react';
import { formatInrShort } from '../utils/format';
import './SdpStats.css';

export interface SdpSummaryStats {
  richest: { state: string; value: number; year: number | null } | null;
  least: { state: string; value: number; year: number | null } | null;
  incomeGap: { absolute: number; ratio: number | null } | null;
  statesTracked: number;
  yearsOfData: { count: number; start: number; end: number } | null;
}

interface SdpStatsProps {
  stats: SdpSummaryStats | null;
  error: string | null;
}

const SdpStats: React.FC<SdpStatsProps> = ({ stats, error }) => {
  if (error) {
    return <div className="sdp-stats-error">{error}</div>;
  }

  const tiles = [
    {
      label: 'Richest (per-capita)',
      value: stats?.richest ? formatInrShort(stats.richest.value) : '—',
      hint: stats?.richest ? `${stats.richest.state}${stats.richest.year ? ` · FY ${stats.richest.year}` : ''}` : 'Loading…',
    },
    {
      label: 'Least (per-capita)',
      value: stats?.least ? formatInrShort(stats.least.value) : '—',
      hint: stats?.least ? `${stats.least.state}${stats.least.year ? ` · FY ${stats.least.year}` : ''}` : 'Loading…',
    },
    {
      label: 'Income Gap',
      value: stats?.incomeGap?.ratio ? `${stats.incomeGap.ratio.toFixed(1)}x` : '—',
      hint: stats?.incomeGap ? `${formatInrShort(stats.incomeGap.absolute)} difference` : 'Loading…',
    },
    {
      label: 'States & UTs Tracked',
      value: stats?.statesTracked ?? '—',
      hint: 'Reporting states & UTs',
    },
    {
      label: 'Years of Data',
      value: stats?.yearsOfData?.count ?? '—',
      hint: stats?.yearsOfData ? `${stats.yearsOfData.start}–${stats.yearsOfData.end}` : 'Loading…',
    },
  ];

  return (
    <div className="sdp-stats">
      {tiles.map((tile) => (
        <div className="sdp-stat-tile" key={tile.label}>
          <span className="sdp-stat-label">{tile.label}</span>
          <span className="sdp-stat-value">{tile.value}</span>
          <span className="sdp-stat-hint">{tile.hint}</span>
        </div>
      ))}
    </div>
  );
};

export default SdpStats;
