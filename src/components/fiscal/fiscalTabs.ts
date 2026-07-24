export type FiscalTabId =
  | 'deficit-trends'
  | 'deficit-gsdp'
  | 'state-rankings'
  | 'revenue-spending-mix'
  | 'debt-liabilities'
  | 'borrowings-guarantees'
  | 'fiscal-stress-map';

export interface FiscalTab {
  id: FiscalTabId;
  label: string;
}

export const FISCAL_TABS: FiscalTab[] = [
  { id: 'deficit-trends', label: 'Deficit Trends' },
  { id: 'deficit-gsdp', label: 'Deficit ÷ GSDP' },
  { id: 'state-rankings', label: 'State Rankings' },
  { id: 'revenue-spending-mix', label: 'Revenue & Spending Mix' },
  { id: 'debt-liabilities', label: 'Debt & Liabilities' },
  { id: 'borrowings-guarantees', label: 'Borrowings & Guarantees' },
  { id: 'fiscal-stress-map', label: 'Fiscal Stress Map' },
];
