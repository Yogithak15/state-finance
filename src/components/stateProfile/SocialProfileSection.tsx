import React, { useEffect, useMemo, useState } from 'react';
import { fetchSocialFinancialYearSeries, SOCIAL_METRICS } from '../../api/socialDemographicApi';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import {
  MetricRow,
  SectionCard,
  ChartGrid,
  ChartBlock,
  StatTileRow,
  TrendChart,
  ComparisonBarChart,
  BarCategoryRow,
  buildTrendData,
  latestForState,
  hasAnyValue,
  fetchMetricRows,
  pct1,
  unitless2,
  oneDecimal,
} from './profileWidgets';

interface Props {
  state: string;
}

const MALE_KEY = 'Male';
const FEMALE_KEY = 'Female';
const TOTAL_KEY = 'Total';
const GPI_KEY = 'GPI';
const INDEX_KEY = 'Index';
const HEADCOUNT_KEY = 'Headcount ratio';
const INTENSITY_KEY = 'Intensity';

const SocialProfileSection: React.FC<Props> = ({ state }) => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];

  const [rows, setRows] = useState<Record<string, MetricRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchMetricRows(fetchSocialFinancialYearSeries, SOCIAL_METRICS)
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load Social and Demographic data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 1 · GER by stage — each metric's own latest available year.
  const gerData: BarCategoryRow[] = useMemo(() => {
    const stages: { category: string; m: string; f: string; t: string }[] = [
      { category: 'Foundational', m: 'gerFoundationalMale', f: 'gerFoundationalFemale', t: 'gerFoundationalTotal' },
      { category: 'Preparatory', m: 'gerPreparatoryMale', f: 'gerPreparatoryFemale', t: 'gerPreparatoryTotal' },
      { category: 'Middle', m: 'gerMiddleMale', f: 'gerMiddleFemale', t: 'gerMiddleTotal' },
      { category: 'Secondary', m: 'gerSecondaryMale', f: 'gerSecondaryFemale', t: 'gerSecondaryTotal' },
    ];
    return stages.map((s) => ({
      category: s.category,
      [MALE_KEY]: latestForState(rows[s.m] ?? [], state)?.value,
      [FEMALE_KEY]: latestForState(rows[s.f] ?? [], state)?.value,
      [TOTAL_KEY]: latestForState(rows[s.t] ?? [], state)?.value,
    }));
  }, [rows, state]);

  // 2 · GPI of GER by level — each metric's own latest available year.
  const gpiData: BarCategoryRow[] = useMemo(() => {
    const levels: { category: string; key: string }[] = [
      { category: 'Primary', key: 'gpiGerPrimary' },
      { category: 'Upper Primary', key: 'gpiGerUpperPrimary' },
      { category: 'Elementary', key: 'gpiGerElementary' },
      { category: 'Secondary', key: 'gpiGerSecondary' },
      { category: 'Higher Secondary', key: 'gpiGerHigherSecondary' },
    ];
    return levels.map((l) => ({ category: l.category, [GPI_KEY]: latestForState(rows[l.key] ?? [], state)?.value }));
  }, [rows, state]);

  // 3 · Birth & death rate
  const birthDeathData = useMemo(
    () => buildTrendData({ 'Birth rate': rows.birthRate, 'Death rate': rows.deathRate }, state),
    [rows, state]
  );

  // 4 · Infant mortality rate
  const imrData = useMemo(
    () => buildTrendData({ 'Infant mortality rate': rows.infantMortalityRate }, state),
    [rows, state]
  );

  // 5 · Total fertility rate
  const tfrData = useMemo(
    () => buildTrendData({ 'Total fertility rate': rows.totalFertilityRate }, state),
    [rows, state]
  );

  // 6 · Maternal mortality ratio (stat tile only)
  const mmrLatest = latestForState(rows.maternalMortalityRatio ?? [], state);

  // 7 · Life expectancy
  const lifeExpectancyData = useMemo(
    () =>
      buildTrendData(
        {
          Male: rows.lifeExpectancyMale,
          Female: rows.lifeExpectancyFemale,
          Total: rows.lifeExpectancyTotal,
        },
        state
      ),
    [rows, state]
  );

  // 8 · MPI Index by NFHS round
  const mpiIndexData: BarCategoryRow[] = useMemo(
    () => [
      { category: 'NFHS-4', [INDEX_KEY]: latestForState(rows.mpiIndexNfhs4 ?? [], state)?.value },
      { category: 'NFHS-5', [INDEX_KEY]: latestForState(rows.mpiIndexNfhs5 ?? [], state)?.value },
    ],
    [rows, state]
  );

  // 9 · Poverty headcount ratio & intensity by NFHS round
  const povertyData: BarCategoryRow[] = useMemo(
    () => [
      {
        category: 'NFHS-4',
        [HEADCOUNT_KEY]: latestForState(rows.mpiHeadcountRatioNfhs4 ?? [], state)?.value,
        [INTENSITY_KEY]: latestForState(rows.mpiIntensityNfhs4 ?? [], state)?.value,
      },
      {
        category: 'NFHS-5',
        [HEADCOUNT_KEY]: latestForState(rows.mpiHeadcountRatioNfhs5 ?? [], state)?.value,
        [INTENSITY_KEY]: latestForState(rows.mpiIntensityNfhs5 ?? [], state)?.value,
      },
    ],
    [rows, state]
  );

  // 10 · Natural population growth rate
  const growthData = useMemo(
    () =>
      buildTrendData(
        {
          Total: rows.populationGrowthRateTotal,
          Rural: rows.populationGrowthRateRural,
          Urban: rows.populationGrowthRateUrban,
        },
        state
      ),
    [rows, state]
  );

  // 11 · Rural unemployment rate
  const ruralUnemploymentData = useMemo(
    () =>
      buildTrendData(
        {
          Male: rows.unemploymentRuralMale,
          Female: rows.unemploymentRuralFemale,
          Persons: rows.unemploymentRuralPersons,
        },
        state
      ),
    [rows, state]
  );

  // 12 · Urban unemployment rate
  const urbanUnemploymentData = useMemo(
    () =>
      buildTrendData(
        {
          Male: rows.unemploymentUrbanMale,
          Female: rows.unemploymentUrbanFemale,
          Persons: rows.unemploymentUrbanPersons,
        },
        state
      ),
    [rows, state]
  );

  // 13 · Domestic tourist visits
  const tourismData = useMemo(
    () => buildTrendData({ 'Domestic tourist visits': rows.domesticTouristVisits }, state),
    [rows, state]
  );

  const gerHasData = gerData.some((r) => r[MALE_KEY] != null || r[FEMALE_KEY] != null || r[TOTAL_KEY] != null);
  const gpiHasData = gpiData.some((r) => r[GPI_KEY] != null);
  const mpiIndexHasData = mpiIndexData.some((r) => r[INDEX_KEY] != null);
  const povertyHasData = povertyData.some((r) => r[HEADCOUNT_KEY] != null || r[INTENSITY_KEY] != null);

  const empty =
    !loading &&
    !gerHasData &&
    !gpiHasData &&
    !hasAnyValue(birthDeathData, ['Birth rate', 'Death rate']) &&
    !hasAnyValue(imrData, ['Infant mortality rate']) &&
    !hasAnyValue(tfrData, ['Total fertility rate']) &&
    !mmrLatest &&
    !hasAnyValue(lifeExpectancyData, ['Male', 'Female', 'Total']) &&
    !mpiIndexHasData &&
    !povertyHasData &&
    !hasAnyValue(growthData, ['Total', 'Rural', 'Urban']) &&
    !hasAnyValue(ruralUnemploymentData, ['Male', 'Female', 'Persons']) &&
    !hasAnyValue(urbanUnemploymentData, ['Male', 'Female', 'Persons']) &&
    !hasAnyValue(tourismData, ['Domestic tourist visits']);

  return (
    <SectionCard
      title="6 · Social & Demographic"
      description="Education enrolment and gender parity, vital rates, poverty, population growth, unemployment, and tourism."
      loading={loading}
      error={error}
      empty={empty}
      stateName={state}
    >
      <StatTileRow
        tiles={[
          {
            label: 'Maternal Mortality Ratio',
            value: mmrLatest ? Math.round(mmrLatest.value).toString() : '—',
            hint: mmrLatest ? `per 100,000 live births · FY ${mmrLatest.period}` : 'No data',
          },
        ]}
      />
      <ChartGrid>
        <ChartBlock title="Gross Enrolment Ratio by stage (latest available year per series, %)">
          <ComparisonBarChart
            data={gerData}
            series={[
              { key: MALE_KEY, label: 'Male', color: colors.categorical[0] },
              { key: FEMALE_KEY, label: 'Female', color: colors.categorical[5] },
              { key: TOTAL_KEY, label: 'Total', color: colors.ink },
            ]}
            yFormatter={pct1}
            colors={colors}
          />
        </ChartBlock>
        <ChartBlock title="Gender Parity Index of GER by level">
          <ComparisonBarChart
            data={gpiData}
            series={[{ key: GPI_KEY, label: 'GPI', color: colors.categorical[4] }]}
            yFormatter={unitless2}
            colors={colors}
            referenceLines={[{ y: 1, label: 'Parity', color: colors.muted }]}
          />
        </ChartBlock>
        <ChartBlock title="Birth rate & death rate over time (per 1,000 population)">
          <TrendChart
            data={birthDeathData}
            series={[
              { key: 'Birth rate', label: 'Birth rate', color: colors.categorical[1] },
              { key: 'Death rate', label: 'Death rate', color: colors.categorical[5] },
            ]}
            yFormatter={oneDecimal}
            colors={colors}
          />
        </ChartBlock>
        <ChartBlock title="Infant mortality rate over time (per 1,000 live births)">
          <TrendChart
            data={imrData}
            series={[{ key: 'Infant mortality rate', label: 'Infant mortality rate', color: colors.categorical[5] }]}
            yFormatter={oneDecimal}
            colors={colors}
          />
        </ChartBlock>
        <ChartBlock title="Total fertility rate over time (children per woman)">
          <TrendChart
            data={tfrData}
            series={[{ key: 'Total fertility rate', label: 'Total fertility rate', color: colors.categorical[2] }]}
            yFormatter={unitless2}
            colors={colors}
            referenceLines={[{ y: 2.1, label: 'Replacement level', color: colors.muted }]}
          />
        </ChartBlock>
        <ChartBlock title="Life expectancy at birth over time (years)">
          <TrendChart
            data={lifeExpectancyData}
            series={[
              { key: 'Male', label: 'Male', color: colors.categorical[0] },
              { key: 'Female', label: 'Female', color: colors.categorical[5] },
              { key: 'Total', label: 'Total', color: colors.ink },
            ]}
            yFormatter={oneDecimal}
            colors={colors}
          />
        </ChartBlock>
        <ChartBlock title="Multidimensional Poverty Index by NFHS round">
          <ComparisonBarChart
            data={mpiIndexData}
            series={[{ key: INDEX_KEY, label: 'MPI Index', color: colors.categorical[3] }]}
            yFormatter={unitless2}
            colors={colors}
          />
        </ChartBlock>
        <ChartBlock title="Poverty headcount ratio & intensity by NFHS round (%)">
          <ComparisonBarChart
            data={povertyData}
            series={[
              { key: HEADCOUNT_KEY, label: 'Headcount ratio', color: colors.categorical[0] },
              { key: INTENSITY_KEY, label: 'Intensity', color: colors.categorical[6] },
            ]}
            yFormatter={pct1}
            colors={colors}
          />
        </ChartBlock>
        <ChartBlock title="Natural population growth rate over time (%)">
          <TrendChart
            data={growthData}
            series={[
              { key: 'Total', label: 'Total', color: colors.ink },
              { key: 'Rural', label: 'Rural', color: colors.categorical[3] },
              { key: 'Urban', label: 'Urban', color: colors.categorical[0] },
            ]}
            yFormatter={oneDecimal}
            colors={colors}
          />
        </ChartBlock>
        <ChartBlock title="Rural unemployment rate over time (per 1,000 labour force)">
          <TrendChart
            data={ruralUnemploymentData}
            series={[
              { key: 'Male', label: 'Male', color: colors.categorical[0] },
              { key: 'Female', label: 'Female', color: colors.categorical[5] },
              { key: 'Persons', label: 'Persons', color: colors.ink },
            ]}
            yFormatter={oneDecimal}
            colors={colors}
          />
        </ChartBlock>
        <ChartBlock title="Urban unemployment rate over time (per 1,000 labour force)">
          <TrendChart
            data={urbanUnemploymentData}
            series={[
              { key: 'Male', label: 'Male', color: colors.categorical[0] },
              { key: 'Female', label: 'Female', color: colors.categorical[5] },
              { key: 'Persons', label: 'Persons', color: colors.ink },
            ]}
            yFormatter={oneDecimal}
            colors={colors}
          />
        </ChartBlock>
        <ChartBlock title="Domestic tourist visits over time (millions)">
          <TrendChart
            data={tourismData}
            series={[
              { key: 'Domestic tourist visits', label: 'Domestic tourist visits', color: colors.categorical[2] },
            ]}
            yFormatter={oneDecimal}
            colors={colors}
          />
        </ChartBlock>
      </ChartGrid>
    </SectionCard>
  );
};

export default SocialProfileSection;
