export type BankingTabId =
  | 'deposits-credit-trend'
  | 'credit-deposit-ratio'
  | 'state-rankings'
  | 'credit-mix'
  | 'banking-penetration'
  | 'rural-vs-urban-reach';

export interface BankingTab {
  id: BankingTabId;
  label: string;
}

export const BANKING_TABS: BankingTab[] = [
  { id: 'deposits-credit-trend', label: 'Deposits & Credit' },
  { id: 'credit-deposit-ratio', label: 'Credit-Deposit Ratio' },
  { id: 'state-rankings', label: 'State Rankings' },
  { id: 'credit-mix', label: 'Credit Mix' },
  { id: 'banking-penetration', label: 'Banking Penetration' },
  { id: 'rural-vs-urban-reach', label: 'Rural vs Urban Reach' },
];
