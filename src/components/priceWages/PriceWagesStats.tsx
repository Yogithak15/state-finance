import React from 'react';
import './PriceWagesStats.css';

export interface PwSummaryStats {
  highest: { state: string; value: number; year: string | null } | null;
  lowest: { state: string; value: number; year: string | null } | null;
  allIndia: { value: number; year: string | null } | null;
  statesTracked: number;
  yearsOfData: { count: number; start: number; end: number } | null;
}

interface PriceWagesStatsProps {
  stats: PwSummaryStats | null;
  error: string | null;
}

const pct = (v: number) => `${v.toFixed(1)}%`;

const PriceWagesStats: React.FC<PriceWagesStatsProps> = ({ stats, error }) => {
  if (error) {
    return <div className="pw-stats-error">{error}</div>;
  }

  const latestYear = stats?.highest?.year ?? stats?.allIndia?.year ?? null;

  const tiles = [
    {
      label: `Highest Inflation${latestYear ? ` (${latestYear})` : ''}`,
      value: stats?.highest ? pct(stats.highest.value) : '—',
      hint: stats?.highest ? stats.highest.state : 'Loading…',
    },
    {
      label: `Lowest Inflation${latestYear ? ` (${latestYear})` : ''}`,
      value: stats?.lowest ? pct(stats.lowest.value) : '—',
      hint: stats?.lowest ? stats.lowest.state : 'Loading…',
    },
    {
      label: `All-India${latestYear ? ` (${latestYear})` : ''}`,
      value: stats?.allIndia ? pct(stats.allIndia.value) : '—',
      hint: 'Average across reporting states',
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
    <div className="pw-stats">
      {tiles.map((tile) => (
        <div className="pw-stat-tile" key={tile.label}>
          <span className="pw-stat-label">{tile.label}</span>
          <span className="pw-stat-value">{tile.value}</span>
          <span className="pw-stat-hint">{tile.hint}</span>
        </div>
      ))}
    </div>
  );
};

export default PriceWagesStats;
