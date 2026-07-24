import { analyticsAggregate } from './bond_api';
import { fetchSdpStateDimensions } from './stateDomesticProductApi';

// ─────────────────────────────────────────────────────────────────────────────
//  Compare States — generic metric fetch
//
//  Unlike every other per-dataset API file in this project, this one is NOT
//  bound to a single source_id: source_id and metric_id are both runtime
//  parameters, since "Compare States" lets the user pick any one metric out
//  of every RBI dataset tracked in the dashboard.
//
//  dimension_type_id is always 72 (State) and date_attribute_type_id is
//  always 3 — every dataset here shares that exact dimension_type and state
//  list, via fetchSdpStateDimensions().
// ─────────────────────────────────────────────────────────────────────────────

export const fetchCompareMetricSeries = async (sourceId, metricId) => {
  const dims = await fetchSdpStateDimensions();
  const dimensionIds = dims.map((d) => d.dimension_id ?? d.id).filter(Boolean);

  const rows = await analyticsAggregate({
    source_id: sourceId,
    date_attribute_type_id: 3,
    metric_id: metricId,
    dimension_id: dimensionIds,
    granularity: 'financial_year',
    aggregation: 'sum',
    limit: 500,
  });

  return rows.filter((r) => r.value != null);
};

// ── Metric catalog, grouped by dataset ───────────────────────────────────────
//
//  IMPORTANT: `unit: 'index'` on the 5 GPI metrics and 2 MPI Index metrics is
//  a DELIBERATE override, not the raw unit the live API reports (the API
//  actually tags the GPI metrics as "percentage" and the MPI Index metrics as
//  null). GPI is a ~0.8-1.2 ratio and MPI Index is a ~0-1 score — formatting
//  either with a literal "%" sign would misleadingly imply a near-zero value.
//  This mirrors the judgment already applied in SocialProfileSection.tsx
//  (plain 2-decimal `unitless2` formatting, no percent sign).
export const COMPARE_METRIC_GROUPS = [
  {
    groupLabel: 'State Domestic Product',
    sourceId: 57,
    metrics: [
      { key: 'sdp_per_capita_current', metricId: 199, label: 'Per-Capita NSDP (current prices)', unit: 'amount' },
      { key: 'sdp_per_capita_constant', metricId: 200, label: 'Per-Capita NSDP (constant prices)', unit: 'amount' },
      { key: 'sdp_gsdp_current', metricId: 201, label: 'GSDP (current prices)', unit: 'amount' },
      { key: 'sdp_gsdp_constant', metricId: 202, label: 'GSDP (constant prices)', unit: 'amount' },
      { key: 'sdp_nsdp_current', metricId: 203, label: 'NSDP (current prices)', unit: 'amount' },
      { key: 'sdp_nsdp_constant', metricId: 204, label: 'NSDP (constant prices)', unit: 'amount' },
    ],
  },
  {
    groupLabel: 'Price & Wages',
    sourceId: 58,
    metrics: [
      { key: 'pw_cpi_general', metricId: 205, label: 'CPI Inflation — General (%)', unit: 'percentage' },
      { key: 'pw_cpi_food', metricId: 256, label: 'CPI Inflation — Food & Beverages (%)', unit: 'percentage' },
      { key: 'pw_cpi_fuel', metricId: 257, label: 'CPI Inflation — Fuel & Light (%)', unit: 'percentage' },
      { key: 'pw_cpi_housing', metricId: 258, label: 'CPI Inflation — Housing, Urban (%)', unit: 'percentage' },
      { key: 'pw_wage_construction', metricId: 259, label: 'Daily Wage — Construction Workers (₹)', unit: 'amount' },
      { key: 'pw_wage_agri', metricId: 260, label: 'Daily Wage — General Agricultural Labourers (₹)', unit: 'amount' },
      { key: 'pw_wage_horticulture', metricId: 261, label: 'Daily Wage — Horticulture Workers (₹)', unit: 'amount' },
      { key: 'pw_wage_non_agri', metricId: 262, label: 'Daily Wage — Non-Agricultural Labourers (₹)', unit: 'amount' },
    ],
  },
  {
    groupLabel: 'Banking',
    sourceId: 61,
    metrics: [
      { key: 'bk_scb_offices', metricId: 244, label: 'SCB Offices (count)', unit: 'number' },
      { key: 'bk_scb_cd_sanction', metricId: 245, label: 'SCB Credit-Deposit Ratio, Place of Sanction (%)', unit: 'percentage' },
      { key: 'bk_scb_cd_utilisation', metricId: 246, label: 'SCB Credit-Deposit Ratio, Place of Utilisation (%)', unit: 'percentage' },
      { key: 'bk_scb_deposits', metricId: 247, label: 'SCB Deposits (₹)', unit: 'amount' },
      { key: 'bk_scb_credit', metricId: 248, label: 'SCB Credit (₹)', unit: 'amount' },
      { key: 'bk_scb_credit_agri', metricId: 249, label: 'SCB Credit to Agriculture (₹)', unit: 'amount' },
      { key: 'bk_scb_credit_industry', metricId: 250, label: 'SCB Credit to Industry (₹)', unit: 'amount' },
      { key: 'bk_scb_personal_loans', metricId: 251, label: 'SCB Personal Loans (₹)', unit: 'amount' },
      { key: 'bk_rrb_deposits', metricId: 252, label: 'RRB Deposits (₹)', unit: 'amount' },
      { key: 'bk_rrb_credit', metricId: 253, label: 'RRB Credit (₹)', unit: 'amount' },
      { key: 'bk_rrb_cd_ratio', metricId: 254, label: 'RRB Credit-Deposit Ratio (%)', unit: 'percentage' },
      { key: 'bk_rrb_branches', metricId: 255, label: 'RRB Branches (count)', unit: 'number' },
    ],
  },
  {
    groupLabel: 'Fiscal',
    sourceId: 59,
    metrics: [
      { key: 'fc_gross_fiscal_deficit', metricId: 206, label: 'Gross Fiscal Deficit (₹)', unit: 'amount' },
      { key: 'fc_revenue_deficit', metricId: 207, label: 'Revenue Deficit (₹)', unit: 'amount' },
      { key: 'fc_revenue_expenditure', metricId: 208, label: 'Revenue Expenditure (₹)', unit: 'amount' },
      { key: 'fc_primary_deficit', metricId: 209, label: 'Primary Deficit (₹)', unit: 'amount' },
      { key: 'fc_own_tax_revenue', metricId: 210, label: 'Own Tax Revenue (₹)', unit: 'amount' },
      { key: 'fc_own_non_tax_revenue', metricId: 211, label: 'Own Non-Tax Revenue (₹)', unit: 'amount' },
      { key: 'fc_interest_payments', metricId: 212, label: 'Interest Payments (₹)', unit: 'amount' },
      { key: 'fc_pension_expenditure', metricId: 213, label: 'Pension Expenditure (₹)', unit: 'amount' },
      { key: 'fc_capital_receipts', metricId: 214, label: 'Capital Receipts (₹)', unit: 'amount' },
      { key: 'fc_capital_expenditure', metricId: 215, label: 'Capital Expenditure (₹)', unit: 'amount' },
      { key: 'fc_capital_outlay', metricId: 216, label: 'Capital Outlay (₹)', unit: 'amount' },
      { key: 'fc_social_sector_expenditure', metricId: 217, label: 'Social Sector Expenditure (₹)', unit: 'amount' },
      { key: 'fc_outstanding_liabilities', metricId: 218, label: 'Outstanding Liabilities (₹)', unit: 'amount' },
      { key: 'fc_outstanding_guarantees', metricId: 219, label: 'Outstanding Guarantees (₹)', unit: 'amount' },
      { key: 'fc_market_borrowings', metricId: 220, label: 'Market Borrowings (₹)', unit: 'amount' },
    ],
  },
  {
    groupLabel: 'Health',
    sourceId: 60,
    metrics: [
      { key: 'hl_anaemia_children_nfhs3', metricId: 221, label: 'Anaemia — Children 6-59mo, NFHS-3 (%)', unit: 'percentage' },
      { key: 'hl_anaemia_children_nfhs4', metricId: 222, label: 'Anaemia — Children 6-59mo, NFHS-4 (%)', unit: 'percentage' },
      { key: 'hl_anaemia_children_nfhs5', metricId: 223, label: 'Anaemia — Children 6-59mo, NFHS-5 (%)', unit: 'percentage' },
      { key: 'hl_anaemia_pregnant_nfhs3', metricId: 224, label: 'Anaemia — Pregnant Women 15-49y, NFHS-3 (%)', unit: 'percentage' },
      { key: 'hl_anaemia_pregnant_nfhs4', metricId: 225, label: 'Anaemia — Pregnant Women 15-49y, NFHS-4 (%)', unit: 'percentage' },
      { key: 'hl_anaemia_pregnant_nfhs5', metricId: 226, label: 'Anaemia — Pregnant Women 15-49y, NFHS-5 (%)', unit: 'percentage' },
      { key: 'hl_phc_doctors_required', metricId: 227, label: 'PHC Doctors Required (count)', unit: 'number' },
      { key: 'hl_phc_doctors_sanctioned', metricId: 228, label: 'PHC Doctors Sanctioned (count)', unit: 'number' },
      { key: 'hl_phc_doctors_in_position', metricId: 229, label: 'PHC Doctors In Position (count)', unit: 'number' },
      { key: 'hl_phc_doctors_vacant', metricId: 230, label: 'PHC Doctors Vacant (count)', unit: 'number' },
      { key: 'hl_phc_doctors_shortfall', metricId: 231, label: 'PHC Doctors Shortfall (count)', unit: 'number' },
      { key: 'hl_chc_specialists_required', metricId: 232, label: 'CHC Specialists Required (count)', unit: 'number' },
      { key: 'hl_chc_specialists_sanctioned', metricId: 233, label: 'CHC Specialists Sanctioned (count)', unit: 'number' },
      { key: 'hl_chc_specialists_in_position', metricId: 234, label: 'CHC Specialists In Position (count)', unit: 'number' },
      { key: 'hl_chc_specialists_vacant', metricId: 235, label: 'CHC Specialists Vacant (count)', unit: 'number' },
      { key: 'hl_chc_specialists_shortfall', metricId: 236, label: 'CHC Specialists Shortfall (count)', unit: 'number' },
      { key: 'hl_govt_hospitals_rural', metricId: 237, label: 'Government Hospitals, Rural (count)', unit: 'number' },
      { key: 'hl_govt_hospitals_urban', metricId: 238, label: 'Government Hospitals, Urban (count)', unit: 'number' },
      { key: 'hl_govt_hospitals_total', metricId: 239, label: 'Government Hospitals, Total (count)', unit: 'number' },
      { key: 'hl_govt_hospital_beds_rural', metricId: 240, label: 'Government Hospital Beds, Rural (count)', unit: 'number' },
      { key: 'hl_govt_hospital_beds_urban', metricId: 241, label: 'Government Hospital Beds, Urban (count)', unit: 'number' },
      { key: 'hl_govt_hospital_beds_total', metricId: 242, label: 'Government Hospital Beds, Total (count)', unit: 'number' },
      { key: 'hl_public_expenditure_health', metricId: 243, label: 'Public Expenditure on Health (₹)', unit: 'amount' },
    ],
  },
  {
    groupLabel: 'Social & Demographic',
    sourceId: 62,
    metrics: [
      { key: 'sc_ger_foundational_male', metricId: 263, label: 'GER Foundational, Male (%)', unit: 'percentage' },
      { key: 'sc_ger_foundational_female', metricId: 264, label: 'GER Foundational, Female (%)', unit: 'percentage' },
      { key: 'sc_ger_foundational_total', metricId: 265, label: 'GER Foundational, Total (%)', unit: 'percentage' },
      { key: 'sc_ger_preparatory_male', metricId: 266, label: 'GER Preparatory, Male (%)', unit: 'percentage' },
      { key: 'sc_ger_preparatory_female', metricId: 267, label: 'GER Preparatory, Female (%)', unit: 'percentage' },
      { key: 'sc_ger_preparatory_total', metricId: 268, label: 'GER Preparatory, Total (%)', unit: 'percentage' },
      { key: 'sc_ger_middle_male', metricId: 269, label: 'GER Middle, Male (%)', unit: 'percentage' },
      { key: 'sc_ger_middle_female', metricId: 270, label: 'GER Middle, Female (%)', unit: 'percentage' },
      { key: 'sc_ger_middle_total', metricId: 271, label: 'GER Middle, Total (%)', unit: 'percentage' },
      { key: 'sc_ger_secondary_female', metricId: 272, label: 'GER Secondary, Female (%)', unit: 'percentage' },
      { key: 'sc_ger_secondary_total', metricId: 273, label: 'GER Secondary, Total (%)', unit: 'percentage' },
      { key: 'sc_ger_secondary_male', metricId: 297, label: 'GER Secondary, Male (%)', unit: 'percentage' },
      { key: 'sc_birth_rate', metricId: 274, label: 'Birth Rate (per 1,000 population)', unit: 'number' },
      { key: 'sc_death_rate', metricId: 275, label: 'Death Rate (per 1,000 population)', unit: 'number' },
      { key: 'sc_infant_mortality_rate', metricId: 276, label: 'Infant Mortality Rate (per 1,000 live births)', unit: 'number' },
      { key: 'sc_maternal_mortality_ratio', metricId: 277, label: 'Maternal Mortality Ratio (per 100,000 live births)', unit: 'number' },
      { key: 'sc_total_fertility_rate', metricId: 278, label: 'Total Fertility Rate (children per woman)', unit: 'number' },
      { key: 'sc_life_expectancy_male', metricId: 279, label: 'Life Expectancy, Male (years)', unit: 'number' },
      { key: 'sc_life_expectancy_female', metricId: 280, label: 'Life Expectancy, Female (years)', unit: 'number' },
      { key: 'sc_life_expectancy_total', metricId: 281, label: 'Life Expectancy, Total (years)', unit: 'number' },
      { key: 'sc_mpi_headcount_nfhs4', metricId: 282, label: 'Poverty Headcount Ratio, NFHS-4 (%)', unit: 'percentage' },
      { key: 'sc_mpi_intensity_nfhs4', metricId: 283, label: 'Poverty Intensity, NFHS-4 (%)', unit: 'percentage' },
      { key: 'sc_mpi_index_nfhs4', metricId: 284, label: 'Multidimensional Poverty Index, NFHS-4', unit: 'index' },
      { key: 'sc_mpi_headcount_nfhs5', metricId: 285, label: 'Poverty Headcount Ratio, NFHS-5 (%)', unit: 'percentage' },
      { key: 'sc_mpi_intensity_nfhs5', metricId: 286, label: 'Poverty Intensity, NFHS-5 (%)', unit: 'percentage' },
      { key: 'sc_mpi_index_nfhs5', metricId: 287, label: 'Multidimensional Poverty Index, NFHS-5', unit: 'index' },
      { key: 'sc_pop_growth_total', metricId: 288, label: 'Natural Population Growth Rate, Total (%)', unit: 'percentage' },
      { key: 'sc_pop_growth_rural', metricId: 289, label: 'Natural Population Growth Rate, Rural (%)', unit: 'percentage' },
      { key: 'sc_pop_growth_urban', metricId: 290, label: 'Natural Population Growth Rate, Urban (%)', unit: 'percentage' },
      { key: 'sc_gpi_primary', metricId: 291, label: 'Gender Parity Index — Primary GER', unit: 'index' },
      { key: 'sc_gpi_upper_primary', metricId: 292, label: 'Gender Parity Index — Upper Primary GER', unit: 'index' },
      { key: 'sc_gpi_elementary', metricId: 293, label: 'Gender Parity Index — Elementary GER', unit: 'index' },
      { key: 'sc_gpi_secondary', metricId: 294, label: 'Gender Parity Index — Secondary GER', unit: 'index' },
      { key: 'sc_gpi_higher_secondary', metricId: 295, label: 'Gender Parity Index — Higher Secondary GER', unit: 'index' },
      { key: 'sc_domestic_tourist_visits', metricId: 296, label: 'Domestic Tourist Visits (millions)', unit: 'number' },
      { key: 'sc_unemployment_rural_male', metricId: 298, label: 'Unemployment Rate, Rural Male (per 1,000)', unit: 'number' },
      { key: 'sc_unemployment_rural_female', metricId: 299, label: 'Unemployment Rate, Rural Female (per 1,000)', unit: 'number' },
      { key: 'sc_unemployment_rural_persons', metricId: 300, label: 'Unemployment Rate, Rural Persons (per 1,000)', unit: 'number' },
      { key: 'sc_unemployment_urban_male', metricId: 301, label: 'Unemployment Rate, Urban Male (per 1,000)', unit: 'number' },
      { key: 'sc_unemployment_urban_female', metricId: 302, label: 'Unemployment Rate, Urban Female (per 1,000)', unit: 'number' },
      { key: 'sc_unemployment_urban_persons', metricId: 303, label: 'Unemployment Rate, Urban Persons (per 1,000)', unit: 'number' },
    ],
  },
];

export const COMPARE_METRIC_MAP = Object.fromEntries(
  COMPARE_METRIC_GROUPS.flatMap((g) =>
    g.metrics.map((m) => [m.key, { ...m, groupLabel: g.groupLabel, sourceId: g.sourceId }])
  )
);
