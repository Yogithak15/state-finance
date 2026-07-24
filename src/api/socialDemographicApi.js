import { analyticsAggregate } from './bond_api';
import { fetchSdpStateDimensions } from './stateDomesticProductApi';

// ─────────────────────────────────────────────────────────────────────────────
//  State Social and Demographic Indicators — API definitions
//
//  dataset_name           : State Social and Demographic Indicators
//  data_source_id         : 62
//  dimension_type         : State
//  dimension_type_id      : 72  (shared with State Domestic Product / Price
//                           and Wages / Banking / Fiscal / Health — same
//                           dimension_type across RBI datasets, reuses the
//                           same dimension list fetcher)
//  date_attribute_type_id : 3
//
//  Metrics — all verified live via
//  GET https://bondanalytics-api.bondbulls.in/data_source_metrics/source/62
// ─────────────────────────────────────────────────────────────────────────────

export const SOCIAL_SOURCE_ID = 62;
export const SOCIAL_DIMENSION_TYPE_ID = 72; // State
export const SOCIAL_DATE_ATTRIBUTE_TYPE_ID = 3;

export const SOCIAL_METRICS = {
  gerFoundationalMale: 263,
  gerFoundationalFemale: 264,
  gerFoundationalTotal: 265,
  gerPreparatoryMale: 266,
  gerPreparatoryFemale: 267,
  gerPreparatoryTotal: 268,
  gerMiddleMale: 269,
  gerMiddleFemale: 270,
  gerMiddleTotal: 271,
  gerSecondaryFemale: 272,
  gerSecondaryTotal: 273,
  gerSecondaryMale: 297,
  birthRate: 274,
  deathRate: 275,
  infantMortalityRate: 276,
  maternalMortalityRatio: 277,
  totalFertilityRate: 278,
  lifeExpectancyMale: 279,
  lifeExpectancyFemale: 280,
  lifeExpectancyTotal: 281,
  mpiHeadcountRatioNfhs4: 282,
  mpiIntensityNfhs4: 283,
  mpiIndexNfhs4: 284,
  mpiHeadcountRatioNfhs5: 285,
  mpiIntensityNfhs5: 286,
  mpiIndexNfhs5: 287,
  populationGrowthRateTotal: 288,
  populationGrowthRateRural: 289,
  populationGrowthRateUrban: 290,
  gpiGerPrimary: 291,
  gpiGerUpperPrimary: 292,
  gpiGerElementary: 293,
  gpiGerSecondary: 294,
  gpiGerHigherSecondary: 295,
  domesticTouristVisits: 296,
  unemploymentRuralMale: 298,
  unemploymentRuralFemale: 299,
  unemploymentRuralPersons: 300,
  unemploymentUrbanMale: 301,
  unemploymentUrbanFemale: 302,
  unemploymentUrbanPersons: 303,
};

// ── Per-state, per-financial-year rows for a social/demographic metric ──────
//   → [{ period, value, dimension_id, dimension_name }, ...] (blank rows dropped)
export const fetchSocialFinancialYearSeries = async (metric_id = SOCIAL_METRICS.birthRate) => {
  const dims = await fetchSdpStateDimensions();
  const dimensionIds = dims.map((d) => d.dimension_id ?? d.id).filter(Boolean);

  const rows = await analyticsAggregate({
    source_id: SOCIAL_SOURCE_ID,
    date_attribute_type_id: SOCIAL_DATE_ATTRIBUTE_TYPE_ID,
    metric_id,
    dimension_id: dimensionIds,
    granularity: 'financial_year',
    aggregation: 'sum',
    limit: 500,
  });

  return rows.filter((r) => r.value != null);
};
