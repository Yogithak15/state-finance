export type PriceWagesTabId =
  | 'inflation-trends'
  | 'state-rankings'
  | 'inflation-heatmap'
  | 'inflation-vs-growth'
  | 'inflation-by-category'
  | 'rural-wage-rates';

export interface PriceWagesTab {
  id: PriceWagesTabId;
  label: string;
}

export const PRICE_WAGES_TABS: PriceWagesTab[] = [
  { id: 'inflation-trends', label: 'Inflation Trends' },
  { id: 'state-rankings', label: 'State Rankings' },
  { id: 'inflation-heatmap', label: 'Inflation Heatmap' },
  { id: 'inflation-vs-growth', label: 'Inflation vs Growth' },
  { id: 'inflation-by-category', label: 'Inflation by Category' },
  { id: 'rural-wage-rates', label: 'Rural Wage Rates' },
];
