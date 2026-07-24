import { analyticsAggregate } from './bond_api';
import { fetchSdpStateDimensions } from './stateDomesticProductApi';

// ─────────────────────────────────────────────────────────────────────────────
//  Banking — API definitions
//
//  dataset_name           : State Banking
//  data_source_id         : 61
//  dimension_type         : State
//  dimension_type_id      : 72  (shared with State Domestic Product / Price
//                           and Wages — same dimension_type across RBI
//                           datasets, reuses the same dimension list fetcher)
//  date_attribute_type_id : 3
//
//  Metrics:
//    244  number_of_scheduled_commercial_bank_offices               (number)
//    245  scb_credit_deposit_ratio_place_of_sanction    (percentage)
//    246  scb_credit_deposit_ratio_place_of_utilisation (percentage)
//    247  scheduled_commercial_banks_deposits                       (INR crore)
//    248  scheduled_commercial_banks_credit                         (INR crore)
//    249  scheduled_commercial_banks_credit_to_agriculture          (INR crore)
//    250  scheduled_commercial_banks_credit_to_industry             (INR crore)
//    251  scheduled_commercial_banks_personal_loans                 (INR crore)
//    252  regional_rural_banks_deposits                             (INR crore)
//    253  regional_rural_banks_credit                               (INR crore)
//    254  regional_rural_banks_credit_deposit_ratio      (percentage)
//    255  number_of_regional_rural_bank_branches                    (number)
// ─────────────────────────────────────────────────────────────────────────────

export const BANKING_SOURCE_ID = 61;
export const BANKING_DIMENSION_TYPE_ID = 72; // State
export const BANKING_DATE_ATTRIBUTE_TYPE_ID = 3;

export const BANKING_METRICS = {
  scbOffices: 244,
  scbCdRatioSanction: 245,
  scbCdRatioUtilisation: 246,
  scbDeposits: 247,
  scbCredit: 248,
  scbCreditAgriculture: 249,
  scbCreditIndustry: 250,
  scbPersonalLoans: 251,
  rrbDeposits: 252,
  rrbCredit: 253,
  rrbCdRatio: 254,
  rrbBranches: 255,
};

// ── Per-state, per-financial-year rows for a metric ──────────────────────────
//   → [{ period, value, dimension_id, dimension_name }, ...] (blank rows dropped)
export const fetchBankingFinancialYearSeries = async (metric_id = BANKING_METRICS.scbOffices) => {
  const dims = await fetchSdpStateDimensions();
  const dimensionIds = dims.map((d) => d.dimension_id ?? d.id).filter(Boolean);

  const rows = await analyticsAggregate({
    source_id: BANKING_SOURCE_ID,
    date_attribute_type_id: BANKING_DATE_ATTRIBUTE_TYPE_ID,
    metric_id,
    dimension_id: dimensionIds,
    granularity: 'financial_year',
    aggregation: 'sum',
    limit: 500,
  });

  return rows.filter((r) => r.value != null);
};

// ── Combined summary for the Banking overview tiles ──────────────────────────
//   Most bank offices · Highest credit-deposit ratio · States & UTs tracked ·
//   Years of data — each stat uses its own metric's latest reporting year.
export const fetchBankingSummaryStats = async () => {
  const [officesRows, cdRows] = await Promise.all([
    fetchBankingFinancialYearSeries(BANKING_METRICS.scbOffices),
    fetchBankingFinancialYearSeries(BANKING_METRICS.scbCdRatioSanction),
  ]);

  const latestPeriodOf = (rows) => {
    const periods = [...new Set(rows.map((r) => r.period))].sort();
    return periods[periods.length - 1] ?? null;
  };

  const officesLatest = latestPeriodOf(officesRows);
  const cdLatest = latestPeriodOf(cdRows);

  const officesLatestRows = officesRows.filter((r) => r.period === officesLatest);
  const cdLatestRows = cdRows.filter((r) => r.period === cdLatest);

  const mostOfficesRow = officesLatestRows.reduce((max, r) => (!max || r.value > max.value ? r : max), null);
  const highestCdRow = cdLatestRows.reduce((max, r) => (!max || r.value > max.value ? r : max), null);

  const periods = [...new Set(officesRows.map((r) => r.period))];
  const numericYears = periods.map((p) => Number(String(p).slice(0, 4))).filter((y) => !Number.isNaN(y));

  return {
    mostOffices: mostOfficesRow && { state: mostOfficesRow.dimension_name, value: mostOfficesRow.value, year: officesLatest },
    highestCdRatio: highestCdRow && { state: highestCdRow.dimension_name, value: highestCdRow.value, year: cdLatest },
    statesTracked: new Set(officesRows.map((r) => r.dimension_id)).size,
    yearsOfData: numericYears.length
      ? { count: numericYears.length, start: Math.min(...numericYears), end: Math.max(...numericYears) }
      : null,
  };
};
