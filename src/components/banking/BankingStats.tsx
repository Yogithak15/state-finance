import React from 'react';
import './BankingStats.css';

export interface BankingSummaryStats {
  mostOffices: { state: string; value: number; year: string | null } | null;
  highestCdRatio: { state: string; value: number; year: string | null } | null;
  statesTracked: number;
  yearsOfData: { count: number; start: number; end: number } | null;
}

interface BankingStatsProps {
  stats: BankingSummaryStats | null;
  error: string | null;
}

const formatCount = (v: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(v);

const BankingStats: React.FC<BankingStatsProps> = ({ stats, error }) => {
  if (error) {
    return <div className="banking-stats-error">{error}</div>;
  }

  const tiles = [
    {
      label: `Most Bank Offices${stats?.mostOffices?.year ? ` (${stats.mostOffices.year})` : ''}`,
      value: stats?.mostOffices ? formatCount(stats.mostOffices.value) : '—',
      hint: stats?.mostOffices ? stats.mostOffices.state : 'Loading…',
    },
    {
      label: `Highest Credit-Deposit Ratio${stats?.highestCdRatio?.year ? ` (${stats.highestCdRatio.year})` : ''}`,
      value: stats?.highestCdRatio ? `${stats.highestCdRatio.value.toFixed(1)}%` : '—',
      hint: stats?.highestCdRatio ? stats.highestCdRatio.state : 'Loading…',
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
    <div className="banking-stats">
      {tiles.map((tile) => (
        <div className="banking-stat-tile" key={tile.label}>
          <span className="banking-stat-label">{tile.label}</span>
          <span className="banking-stat-value">{tile.value}</span>
          <span className="banking-stat-hint">{tile.hint}</span>
        </div>
      ))}
    </div>
  );
};

export default BankingStats;
