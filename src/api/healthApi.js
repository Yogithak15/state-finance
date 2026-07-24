import { analyticsAggregate } from './bond_api';
import { fetchSdpStateDimensions } from './stateDomesticProductApi';

// ─────────────────────────────────────────────────────────────────────────────
//  State Health — API definitions
//
//  dataset_name           : State Health
//  data_source_id         : 60
//  dimension_type         : State
//  dimension_type_id      : 72  (shared with State Domestic Product / Price
//                           and Wages / Banking / Fiscal — same dimension_type
//                           across RBI datasets, reuses the same dimension
//                           list fetcher)
//  date_attribute_type_id : 3
//
//  Metrics — all verified live via
//  GET https://bondanalytics-api.bondbulls.in/data_source_metrics/source/60
// ─────────────────────────────────────────────────────────────────────────────

export const HEALTH_SOURCE_ID = 60;
export const HEALTH_DIMENSION_TYPE_ID = 72; // State
export const HEALTH_DATE_ATTRIBUTE_TYPE_ID = 3;

export const HEALTH_METRICS = {
  anaemiaChildrenNfhs3: 221, // % children 6-59 months anaemic, NFHS-3
  anaemiaChildrenNfhs4: 222,
  anaemiaChildrenNfhs5: 223,
  anaemiaPregnantNfhs3: 224, // % pregnant women 15-49 anaemic, NFHS-3
  anaemiaPregnantNfhs4: 225,
  anaemiaPregnantNfhs5: 226,
  phcDoctorsRequired: 227,
  phcDoctorsSanctioned: 228,
  phcDoctorsInPosition: 229,
  phcDoctorsVacant: 230,
  phcDoctorsShortfall: 231,
  chcSpecialistsRequired: 232,
  chcSpecialistsSanctioned: 233,
  chcSpecialistsInPosition: 234,
  chcSpecialistsVacant: 235,
  chcSpecialistsShortfall: 236,
  govtHospitalsRural: 237,
  govtHospitalsUrban: 238,
  govtHospitalsTotal: 239,
  govtHospitalBedsRural: 240,
  govtHospitalBedsUrban: 241,
  govtHospitalBedsTotal: 242,
  publicExpenditureOnHealth: 243, // Rs crore
};

// ── Per-state, per-financial-year rows for a health metric ──────────────────
//   → [{ period, value, dimension_id, dimension_name }, ...] (blank rows dropped)
export const fetchHealthFinancialYearSeries = async (metric_id = HEALTH_METRICS.publicExpenditureOnHealth) => {
  const dims = await fetchSdpStateDimensions();
  const dimensionIds = dims.map((d) => d.dimension_id ?? d.id).filter(Boolean);

  const rows = await analyticsAggregate({
    source_id: HEALTH_SOURCE_ID,
    date_attribute_type_id: HEALTH_DATE_ATTRIBUTE_TYPE_ID,
    metric_id,
    dimension_id: dimensionIds,
    granularity: 'financial_year',
    aggregation: 'sum',
    limit: 500,
  });

  return rows.filter((r) => r.value != null);
};
