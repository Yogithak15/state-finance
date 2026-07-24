import React, { useEffect, useMemo, useState } from 'react';
import { fetchHealthFinancialYearSeries, HEALTH_METRICS } from '../../api/healthApi';
import { formatInrShort } from '../../utils/format';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import {
  MetricRow,
  SectionCard,
  ChartGrid,
  ChartBlock,
  TrendChart,
  ComparisonBarChart,
  BarCategoryRow,
  buildTrendData,
  latestForState,
  hasAnyValue,
  fetchMetricRows,
  pct1,
  intFmt,
} from './profileWidgets';

interface Props {
  state: string;
}

const CHILDREN_KEY = 'Children (6-59 months)';
const PREGNANT_KEY = 'Pregnant women (15-49 yrs)';

const HealthProfileSection: React.FC<Props> = ({ state }) => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];

  const [rows, setRows] = useState<Record<string, MetricRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchMetricRows(fetchHealthFinancialYearSeries, HEALTH_METRICS)
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load Health data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const anaemiaData: BarCategoryRow[] = useMemo(() => {
    const rounds: { category: string; childKey: string; pregnantKey: string }[] = [
      { category: 'NFHS-3', childKey: 'anaemiaChildrenNfhs3', pregnantKey: 'anaemiaPregnantNfhs3' },
      { category: 'NFHS-4', childKey: 'anaemiaChildrenNfhs4', pregnantKey: 'anaemiaPregnantNfhs4' },
      { category: 'NFHS-5', childKey: 'anaemiaChildrenNfhs5', pregnantKey: 'anaemiaPregnantNfhs5' },
    ];
    return rounds.map((r) => ({
      category: r.category,
      [CHILDREN_KEY]: latestForState(rows[r.childKey] ?? [], state)?.value,
      [PREGNANT_KEY]: latestForState(rows[r.pregnantKey] ?? [], state)?.value,
    }));
  }, [rows, state]);

  const phcData = useMemo(
    () =>
      buildTrendData(
        {
          Sanctioned: rows.phcDoctorsSanctioned,
          'In position': rows.phcDoctorsInPosition,
          Vacant: rows.phcDoctorsVacant,
        },
        state
      ),
    [rows, state]
  );
  const chcData = useMemo(
    () =>
      buildTrendData(
        {
          Sanctioned: rows.chcSpecialistsSanctioned,
          'In position': rows.chcSpecialistsInPosition,
          Vacant: rows.chcSpecialistsVacant,
        },
        state
      ),
    [rows, state]
  );
  const hospitalsData = useMemo(
    () =>
      buildTrendData(
        { Rural: rows.govtHospitalsRural, Urban: rows.govtHospitalsUrban, Total: rows.govtHospitalsTotal },
        state
      ),
    [rows, state]
  );
  const bedsData = useMemo(
    () =>
      buildTrendData(
        { Rural: rows.govtHospitalBedsRural, Urban: rows.govtHospitalBedsUrban, Total: rows.govtHospitalBedsTotal },
        state
      ),
    [rows, state]
  );
  const healthExpenditureData = useMemo(
    () => buildTrendData({ 'Public expenditure on health': rows.publicExpenditureOnHealth }, state),
    [rows, state]
  );

  const anaemiaHasData = anaemiaData.some((r) => r[CHILDREN_KEY] != null || r[PREGNANT_KEY] != null);
  const empty =
    !loading &&
    !anaemiaHasData &&
    !hasAnyValue(phcData, ['Sanctioned', 'In position', 'Vacant']) &&
    !hasAnyValue(chcData, ['Sanctioned', 'In position', 'Vacant']) &&
    !hasAnyValue(hospitalsData, ['Rural', 'Urban', 'Total']) &&
    !hasAnyValue(bedsData, ['Rural', 'Urban', 'Total']) &&
    !hasAnyValue(healthExpenditureData, ['Public expenditure on health']);

  return (
    <SectionCard
      title="5 · Health"
      description="Nutrition indicators, health workforce staffing, government hospital infrastructure, and public health spending."
      loading={loading}
      error={error}
      empty={empty}
      stateName={state}
    >
      <ChartGrid>
        <ChartBlock title="Anaemia prevalence by NFHS round (%)">
          <ComparisonBarChart
            data={anaemiaData}
            series={[
              { key: CHILDREN_KEY, label: CHILDREN_KEY, color: colors.categorical[0] },
              { key: PREGNANT_KEY, label: PREGNANT_KEY, color: colors.categorical[5] },
            ]}
            yFormatter={pct1}
            colors={colors}
          />
        </ChartBlock>
        <ChartBlock title="PHC doctors over time">
          <TrendChart
            data={phcData}
            series={[
              { key: 'Sanctioned', label: 'Sanctioned', color: colors.categorical[0] },
              { key: 'In position', label: 'In position', color: colors.categorical[1] },
              { key: 'Vacant', label: 'Vacant', color: colors.categorical[5] },
            ]}
            yFormatter={intFmt}
            colors={colors}
          />
        </ChartBlock>
        <ChartBlock title="CHC specialists over time">
          <TrendChart
            data={chcData}
            series={[
              { key: 'Sanctioned', label: 'Sanctioned', color: colors.categorical[0] },
              { key: 'In position', label: 'In position', color: colors.categorical[1] },
              { key: 'Vacant', label: 'Vacant', color: colors.categorical[5] },
            ]}
            yFormatter={intFmt}
            colors={colors}
          />
        </ChartBlock>
        <ChartBlock title="Government hospitals over time (rural vs urban vs total)">
          <TrendChart
            data={hospitalsData}
            series={[
              { key: 'Rural', label: 'Rural', color: colors.categorical[3] },
              { key: 'Urban', label: 'Urban', color: colors.categorical[0] },
              { key: 'Total', label: 'Total', color: colors.ink },
            ]}
            yFormatter={intFmt}
            colors={colors}
          />
        </ChartBlock>
        <ChartBlock title="Government hospital beds over time (rural vs urban vs total)">
          <TrendChart
            data={bedsData}
            series={[
              { key: 'Rural', label: 'Rural', color: colors.categorical[3] },
              { key: 'Urban', label: 'Urban', color: colors.categorical[0] },
              { key: 'Total', label: 'Total', color: colors.ink },
            ]}
            yFormatter={intFmt}
            colors={colors}
          />
        </ChartBlock>
        <ChartBlock title="Public expenditure on health over time">
          <TrendChart
            data={healthExpenditureData}
            series={[
              {
                key: 'Public expenditure on health',
                label: 'Public expenditure on health',
                color: colors.categorical[2],
              },
            ]}
            yFormatter={formatInrShort}
            colors={colors}
          />
        </ChartBlock>
      </ChartGrid>
    </SectionCard>
  );
};

export default HealthProfileSection;
