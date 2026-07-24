export type CategoryId = 'sdp' | 'prices-wages' | 'banking' | 'fiscal' | 'state-profile' | 'compare-states';

export interface Category {
  id: CategoryId;
  label: string;
  shortLabel: string;
  description: string;
}

export const CATEGORIES: Category[] = [
  {
    id: 'sdp',
    label: 'State Domestic Product',
    shortLabel: 'SDP',
    description: 'Output, growth, and sectoral composition of the state economy.',
  },
  {
    id: 'prices-wages',
    label: 'Price and Wages',
    shortLabel: 'Prices & Wages',
    description: 'Inflation, price indices, and wage trends across sectors.',
  },
  {
    id: 'banking',
    label: 'Banking',
    shortLabel: 'Banking',
    description: 'Deposits, credit, branch network, and banking penetration.',
  },
  {
    id: 'fiscal',
    label: 'Fiscal',
    shortLabel: 'Fiscal',
    description: 'Revenue, expenditure, deficits, and public debt position.',
  },
  {
    id: 'state-profile',
    label: 'State Profile',
    shortLabel: 'Profile',
    description: 'Every tracked indicator for one state, across all RBI datasets in this dashboard.',
  },
  {
    id: 'compare-states',
    label: 'Compare States',
    shortLabel: 'Compare',
    description: 'Compare two or more states head-to-head on any tracked metric.',
  },
];
