import { analyticsAggregate } from './bond_api';
import { fetchSdpStateDimensions } from './stateDomesticProductApi';

// ─────────────────────────────────────────────────────────────────────────────
//  Price and Wages — API definitions
//
//  dataset_name           : State wise Average Inflation (CPI) - General
//  data_source_id         : 58
//  dimension_type         : State
//  dimension_type_id      : 72  (shared with State Domestic Product — same
//                           dimension_type across RBI datasets, reuses the
//                           same dimension list fetcher)
//  date_attribute_type_id : 3
//
//  Metrics:
//    205  average_inflation_cpi_general                          (percentage)
//    256  average_inflation_cpi_food_and_beverages_percentage     (percentage)
//    257  average_inflation_cpi_fuel_and_light_percentage         (percentage)
//    258  average_inflation_cpi_housing_urban_percentage          (percentage)
//    259  average_daily_wage_rate_rural_men_construction_workers  (INR)
//    260  average_daily_wage_rate_rural_men_general_agricultural_labourers (INR)
//    261  average_daily_wage_rate_rural_men_horticulture_workers  (INR)
//    262  average_daily_wage_rate_rural_men_non_agricultural_labourers (INR)
// ─────────────────────────────────────────────────────────────────────────────

export const PW_SOURCE_ID = 58;
export const PW_DIMENSION_TYPE_ID = 72; // State
export const PW_DATE_ATTRIBUTE_TYPE_ID = 3;

export const PW_METRICS = {
  cpiGeneral: 205,
  cpiFoodBeverages: 256,
  cpiFuelLight: 257,
  cpiHousingUrban: 258,
  wageConstruction: 259,
  wageAgricultural: 260,
  wageHorticulture: 261,
  wageNonAgricultural: 262,
};

// ── Per-state, per-financial-year inflation rows for a metric ───────────────
//   → [{ period, value, dimension_id, dimension_name }, ...] (zero/blank rows dropped)
export const fetchPwFinancialYearSeries = async (metric_id = PW_METRICS.cpiGeneral) => {
  const dims = await fetchSdpStateDimensions();
  const dimensionIds = dims.map((d) => d.dimension_id ?? d.id).filter(Boolean);

  const rows = await analyticsAggregate({
    source_id: PW_SOURCE_ID,
    date_attribute_type_id: PW_DATE_ATTRIBUTE_TYPE_ID,
    metric_id,
    dimension_id: dimensionIds,
    granularity: 'financial_year',
    aggregation: 'sum',
    limit: 500,
  });

  return rows.filter((r) => r.value != null);
};

// ── Combined summary for the Price and Wages overview tiles ──────────────────
//   Highest / Lowest inflation · All-India average · States & UTs tracked ·
//   Years of data — all at the latest common reporting year.
export const fetchPwSummaryStats = async () => {
  const rows = await fetchPwFinancialYearSeries(PW_METRICS.cpiGeneral);

  const periods = [...new Set(rows.map((r) => r.period))].sort();
  const latestPeriod = periods[periods.length - 1] ?? null;
  const latestRows = rows.filter((r) => r.period === latestPeriod);

  const highestRow = latestRows.reduce((max, r) => (!max || r.value > max.value ? r : max), null);
  const lowestRow = latestRows.reduce((min, r) => (!min || r.value < min.value ? r : min), null);
  const allIndiaAvg = latestRows.length
    ? latestRows.reduce((sum, r) => sum + r.value, 0) / latestRows.length
    : null;

  const numericYears = periods.map((p) => Number(String(p).slice(0, 4))).filter((y) => !Number.isNaN(y));

  return {
    highest: highestRow && { state: highestRow.dimension_name, value: highestRow.value, year: highestRow.period },
    lowest: lowestRow && { state: lowestRow.dimension_name, value: lowestRow.value, year: lowestRow.period },
    allIndia: allIndiaAvg != null ? { value: allIndiaAvg, year: latestPeriod } : null,
    statesTracked: new Set(rows.map((r) => r.dimension_id)).size,
    yearsOfData: numericYears.length
      ? { count: numericYears.length, start: Math.min(...numericYears), end: Math.max(...numericYears) }
      : null,
  };
};
