export type SdpTabId =
  | 'income-trends'
  | 'state-rankings'
  | 'growth-league'
  | 'economic-weight'
  | 'real-vs-nominal'
  | 'growth-heatmap'
  | 'growth-vs-prosperity';

export interface SdpTab {
  id: SdpTabId;
  label: string;
}

export const SDP_TABS: SdpTab[] = [
  { id: 'income-trends', label: 'Income Trends' },
  { id: 'state-rankings', label: 'State Rankings' },
  { id: 'growth-league', label: 'Growth League' },
  { id: 'economic-weight', label: 'Economic Weight' },
  { id: 'real-vs-nominal', label: 'Real vs Nominal' },
  { id: 'growth-heatmap', label: 'Growth Heatmap' },
  { id: 'growth-vs-prosperity', label: 'Growth vs Prosperity' },
];
