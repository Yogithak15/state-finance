import { analyticsAggregate, getAllDimensions, getDataSourceMetrics } from './bond_api';

// ─────────────────────────────────────────────────────────────────────────────
//  State Domestic Product — API definitions
//
//  dataset_name           : State Domestic Product
//  data_source_id         : 57
//  dimension_type         : State
//  dimension_type_id      : 72
//  date_attribute_type_id : 3
//
//  Metrics:
//    199  per_capita_nsdp_current_prices   (INR, per capita)
//    200  per_capita_nsdp_constant_prices  (INR, per capita)
//    201  gsdp_current_prices              (INR, Rs lakh)
//    202  gsdp_constant_prices             (INR, Rs lakh)
//    203  nsdp_current_prices              (INR, Rs lakh)
//    204  nsdp_constant_prices             (INR, Rs lakh)
//
//  NOTE: states report on different cadences — not every state has a row for
//  the most recent year. /analytics/snapshot-data only returns states matching
//  the single most recent date, which silently drops states that haven't
//  reported the newest year yet. So instead we pull every tracked dimension_id
//  explicitly and derive the latest common year from the data itself.
// ─────────────────────────────────────────────────────────────────────────────

export const SDP_SOURCE_ID = 57;
export const SDP_DIMENSION_TYPE_ID = 72; // State
export const SDP_DATE_ATTRIBUTE_TYPE_ID = 3;

export const SDP_METRICS = {
  perCapitaCurrent: 199,
  perCapitaConstant: 200,
  gsdpCurrent: 201,
  gsdpConstant: 202,
  nsdpCurrent: 203,
  nsdpConstant: 204,
};

// ── All state/UT dimension IDs under dimension_type_id 72 ───────────────────
export const fetchSdpStateDimensions = () => getAllDimensions(SDP_DIMENSION_TYPE_ID);

// ── Metric metadata (name/description/currency) straight from the API ───────
//   Used so display copy (e.g. "current prices" vs "constant prices") comes
//   from the dataset itself rather than being retyped in the UI layer.
export const fetchSdpMetricsMeta = () => getDataSourceMetrics(SDP_SOURCE_ID);

// ── Per-state rows for a metric, across every tracked state/UT ──────────────
//   → [{ period, value, dimension_id, dimension_name }, ...] (zero/blank rows dropped)
const fetchSdpStateSeries = async (metric_id, granularity) => {
  const dims = await fetchSdpStateDimensions();
  const dimensionIds = dims.map((d) => d.dimension_id ?? d.id).filter(Boolean);

  const rows = await analyticsAggregate({
    source_id: SDP_SOURCE_ID,
    date_attribute_type_id: SDP_DATE_ATTRIBUTE_TYPE_ID,
    metric_id,
    dimension_id: dimensionIds,
    granularity,
    aggregation: 'sum',
    limit: 500,
  });

  return rows.filter((r) => +(r.value ?? 0) > 0);
};

// ── Per-state, per-calendar-year rows (used by the summary tiles) ───────────
export const fetchSdpStateMetric = (metric_id = SDP_METRICS.perCapitaCurrent) =>
  fetchSdpStateSeries(metric_id, 'year');

// ── Per-state, per-financial-year rows for any metric ────────────────────────
//   Periods come back as "2011-12"-style financial-year labels. Used by both
//   the Income Trends chart and the State Rankings chart.
export const fetchSdpFinancialYearSeries = (metric_id = SDP_METRICS.perCapitaCurrent) =>
  fetchSdpStateSeries(metric_id, 'financial_year');

// ── Combined summary for the State Domestic Product overview tiles ──────────
//   Richest / Least (per-capita NSDP, latest common reporting year) ·
//   Income gap · States & UTs tracked · Years of data
export const fetchSdpSummaryStats = async () => {
  const rows = await fetchSdpStateMetric(SDP_METRICS.perCapitaCurrent);

  const periods = [...new Set(rows.map((r) => r.period))];
  const numericYears = periods
    .map((p) => Number(String(p).slice(0, 4)))
    .filter((y) => !Number.isNaN(y));

  // Richest/Least must compare states within the SAME year — some states
  // (e.g. Sikkim) haven't reported the latest year yet, so comparing them
  // against states that have would mix different years' rupee values.
  const latestPeriod = periods.length ? Math.max(...periods) : null;
  const latestRows = rows.filter((r) => r.period === latestPeriod);

  const richestRow = latestRows.reduce((max, r) => (!max || r.value > max.value ? r : max), null);
  const leastRow = latestRows.reduce((min, r) => (!min || r.value < min.value ? r : min), null);

  return {
    richest: richestRow && { state: richestRow.dimension_name, value: richestRow.value, year: richestRow.period },
    least: leastRow && { state: leastRow.dimension_name, value: leastRow.value, year: leastRow.period },
    incomeGap:
      richestRow && leastRow
        ? {
            absolute: richestRow.value - leastRow.value,
            ratio: leastRow.value ? richestRow.value / leastRow.value : null,
          }
        : null,
    statesTracked: new Set(rows.map((r) => r.dimension_id)).size,
    yearsOfData: numericYears.length
      ? { count: numericYears.length, start: Math.min(...numericYears), end: Math.max(...numericYears) }
      : null,
  };
};
