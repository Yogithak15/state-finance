export type CategoryId = 'sdp' | 'prices-wages' | 'banking' | 'fiscal' | 'state-profile' | 'compare-states';

export interface Category {
  id: CategoryId;
  label: string;
}

export const CATEGORIES: Category[] = [
  { id: 'sdp', label: 'State Domestic Product' },
  { id: 'prices-wages', label: 'Price and Wages' },
  { id: 'banking', label: 'Banking' },
  { id: 'fiscal', label: 'Fiscal' },
  { id: 'state-profile', label: 'State Profile' },
  { id: 'compare-states', label: 'Compare States' },
];
