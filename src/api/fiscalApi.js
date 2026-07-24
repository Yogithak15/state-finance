import { analyticsAggregate } from './bond_api';
import { fetchSdpStateDimensions, fetchSdpFinancialYearSeries, SDP_METRICS } from './stateDomesticProductApi';

// ─────────────────────────────────────────────────────────────────────────────
//  State Fiscal Health — API definitions
//
//  dataset_name           : State Fiscal
//  data_source_id         : 59
//  dimension_type         : State
//  dimension_type_id      : 72  (shared with State Domestic Product / Price
//                           and Wages / Banking — same dimension_type across
//                           RBI datasets, reuses the same dimension fetcher)
//  date_attribute_type_id : 3
//
//  Metrics (all Rs crore unless noted):
//    206  gross_fiscal_deficit
//    207  revenue_deficit
//    208  revenue_expenditure
//    209  primary_deficit
//    210  own_tax_revenue
//    211  own_non_tax_revenue
//    212  interest_payments
//    213  pension_expenditure
//    214  capital_receipts
//    215  capital_expenditure
//    216  capital_outlay
//    217  social_sector_expenditure
//    218  outstanding_liabilities
//    219  outstanding_guarantees
//    220  market_borrowings
//
//  NOTE: there's no direct "total revenue receipts" metric, but Revenue
//  Deficit = Revenue Expenditure − Revenue Receipts by definition, so
//  Revenue Receipts = Revenue Expenditure − Revenue Deficit. Verified against
//  a real card: gives Interest/Revenue = 14.91% for Karnataka FY2024-25,
//  matching the reference exactly (own_tax + own_non_tax alone gives 19.3%,
//  which is wrong — it excludes central transfers).
// ─────────────────────────────────────────────────────────────────────────────

export const FISCAL_SOURCE_ID = 59;
export const FISCAL_DIMENSION_TYPE_ID = 72; // State
export const FISCAL_DATE_ATTRIBUTE_TYPE_ID = 3;

export const FISCAL_METRICS = {
  grossFiscalDeficit: 206,
  revenueDeficit: 207,
  revenueExpenditure: 208,
  primaryDeficit: 209,
  ownTaxRevenue: 210,
  ownNonTaxRevenue: 211,
  interestPayments: 212,
  pensionExpenditure: 213,
  capitalReceipts: 214,
  capitalExpenditure: 215,
  capitalOutlay: 216,
  socialSectorExpenditure: 217,
  outstandingLiabilities: 218,
  outstandingGuarantees: 219,
  marketBorrowings: 220,
};

// A state's fiscal deficit above this share of GSDP breaches the FRBM Act's
// standard state-level ceiling — a real, published fiscal rule.
export const FISCAL_DEFICIT_GSDP_LIMIT = 3;
// RBI's state-finance reports commonly flag interest payments above this
// share of revenue receipts as a debt-servicing strain warning sign.
export const INTEREST_REVENUE_WATCH_LOW = 10;
export const INTEREST_REVENUE_WATCH_HIGH = 15;

// ── Per-state, per-financial-year rows for a fiscal metric ──────────────────
//   → [{ period, value, dimension_id, dimension_name }, ...] (blank rows dropped)
export const fetchFiscalFinancialYearSeries = async (metric_id = FISCAL_METRICS.grossFiscalDeficit) => {
  const dims = await fetchSdpStateDimensions();
  const dimensionIds = dims.map((d) => d.dimension_id ?? d.id).filter(Boolean);

  const rows = await analyticsAggregate({
    source_id: FISCAL_SOURCE_ID,
    date_attribute_type_id: FISCAL_DATE_ATTRIBUTE_TYPE_ID,
    metric_id,
    dimension_id: dimensionIds,
    granularity: 'financial_year',
    aggregation: 'sum',
    limit: 500,
  });

  return rows.filter((r) => r.value != null);
};

const groupByState = (rows) => {
  const map = new Map();
  rows.forEach((r) => {
    if (!map.has(r.dimension_id)) map.set(r.dimension_id, new Map());
    map.get(r.dimension_id).set(r.period, r.value);
  });
  return map;
};

const buildNameMaps = (rows) => {
  const nameToId = new Map();
  const idToName = new Map();
  rows.forEach((r) => {
    if (!nameToId.has(r.dimension_name)) nameToId.set(r.dimension_name, r.dimension_id);
    if (!idToName.has(r.dimension_id)) idToName.set(r.dimension_id, r.dimension_name);
  });
  return { nameToId, idToName };
};

// Each state's own latest year where BOTH series report — states don't all
// report the same latest year, so forcing a single shared year would drop
// states that haven't reported yet (same issue solved elsewhere for SDP).
const computeRatioForAllStates = (numRows, denomRows) => {
  const numByState = groupByState(numRows);
  const denomByState = groupByState(denomRows);
  const results = new Map();
  numByState.forEach((periods, id) => {
    const denomPeriods = denomByState.get(id);
    if (!denomPeriods) return;
    const commonPeriods = Array.from(periods.keys())
      .filter((p) => denomPeriods.has(p) && denomPeriods.get(p) !== 0)
      .sort();
    const latest = commonPeriods[commonPeriods.length - 1];
    if (!latest) return;
    results.set(id, { period: latest, ratio: (periods.get(latest) / denomPeriods.get(latest)) * 100 });
  });
  return results;
};

const latestValueForAllStates = (rows) => {
  const byState = groupByState(rows);
  const results = new Map();
  byState.forEach((periods, id) => {
    const sortedPeriods = Array.from(periods.keys()).sort();
    const latest = sortedPeriods[sortedPeriods.length - 1];
    if (latest) results.set(id, { period: latest, value: periods.get(latest) });
  });
  return results;
};

// Simple average of the trailing (up to 5) year-on-year growth rates —
// verified against Karnataka's real card: gives exactly 12.5%.
const computeTrailingGrowthForAllStates = (rows, maxYears = 5) => {
  const byState = groupByState(rows);
  const results = new Map();
  byState.forEach((periods, id) => {
    const sortedPeriods = Array.from(periods.keys()).sort();
    const window = sortedPeriods.slice(-(maxYears + 1));
    if (window.length < 2) return;
    const growths = [];
    for (let i = 1; i < window.length; i += 1) {
      const prev = periods.get(window[i - 1]);
      const curr = periods.get(window[i]);
      if (prev > 0) growths.push(((curr - prev) / prev) * 100);
    }
    if (!growths.length) return;
    results.set(id, {
      period: window[window.length - 1],
      avg: growths.reduce((sum, v) => sum + v, 0) / growths.length,
    });
  });
  return results;
};

const deriveRevenueReceipts = (revExpRows, revDefRows) => {
  const defByKey = new Map(revDefRows.map((r) => [`${r.dimension_id}|${r.period}`, r.value]));
  return revExpRows
    .filter((r) => defByKey.has(`${r.dimension_id}|${r.period}`))
    .map((r) => ({ ...r, value: r.value - defByKey.get(`${r.dimension_id}|${r.period}`) }));
};

const average = (map, field) => {
  const values = Array.from(map.values()).map((v) => v[field]);
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
};

// ── The 5 key fiscal-health metrics for one state, plus peer/national ───────
//   averages (each state uses its own latest available year throughout).
export const fetchFiscalKeyMetrics = async (stateName) => {
  const [gsdp, gfd, liabilities, revExp, revDef, interest] = await Promise.all([
    fetchSdpFinancialYearSeries(SDP_METRICS.gsdpCurrent),
    fetchFiscalFinancialYearSeries(FISCAL_METRICS.grossFiscalDeficit),
    fetchFiscalFinancialYearSeries(FISCAL_METRICS.outstandingLiabilities),
    fetchFiscalFinancialYearSeries(FISCAL_METRICS.revenueExpenditure),
    fetchFiscalFinancialYearSeries(FISCAL_METRICS.revenueDeficit),
    fetchFiscalFinancialYearSeries(FISCAL_METRICS.interestPayments),
  ]);

  const revenueReceiptsRows = deriveRevenueReceipts(revExp, revDef);

  const fiscalDeficitGsdpAll = computeRatioForAllStates(gfd, gsdp);
  const debtGsdpAll = computeRatioForAllStates(liabilities, gsdp);
  const interestRevenueAll = computeRatioForAllStates(interest, revenueReceiptsRows);
  const revenueDeficitAll = latestValueForAllStates(revDef);
  const gsdpGrowthAll = computeTrailingGrowthForAllStates(gsdp);

  const { nameToId } = buildNameMaps([...gsdp, ...gfd, ...liabilities]);
  const stateId = nameToId.get(stateName);

  return {
    availableStates: Array.from(nameToId.keys()).sort((a, b) => a.localeCompare(b)),
    statesTracked: nameToId.size,
    fiscalDeficitGsdp: (stateId != null && fiscalDeficitGsdpAll.get(stateId)) || null,
    debtGsdp: (stateId != null && debtGsdpAll.get(stateId)) || null,
    interestRevenue: (stateId != null && interestRevenueAll.get(stateId)) || null,
    revenueDeficit: (stateId != null && revenueDeficitAll.get(stateId)) || null,
    gsdpGrowth: (stateId != null && gsdpGrowthAll.get(stateId)) || null,
    peerDebtGsdpAvg: average(debtGsdpAll, 'ratio'),
    nationalGsdpGrowthAvg: average(gsdpGrowthAll, 'avg'),
  };
};
