import React, { useEffect, useMemo, useState } from 'react';
import { fetchPwFinancialYearSeries, PW_METRICS } from '../../api/priceWagesApi';
import { formatInr } from '../../utils/format';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import {
  MetricRow,
  SectionCard,
  ChartGrid,
  ChartBlock,
  TrendChart,
  buildTrendData,
  hasAnyValue,
  fetchMetricRows,
  pct1,
} from './profileWidgets';

interface Props {
  state: string;
}

const PriceWagesProfileSection: React.FC<Props> = ({ state }) => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];

  const [rows, setRows] = useState<Record<string, MetricRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchMetricRows(fetchPwFinancialYearSeries, PW_METRICS)
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load Price and Wages data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const inflationKeys = ['General', 'Food & beverages', 'Fuel & light', 'Housing (urban)'];
  const inflationData = useMemo(
    () =>
      buildTrendData(
        {
          General: rows.cpiGeneral,
          'Food & beverages': rows.cpiFoodBeverages,
          'Fuel & light': rows.cpiFuelLight,
          'Housing (urban)': rows.cpiHousingUrban,
        },
        state
      ),
    [rows, state]
  );

  const wageKeys = ['Construction', 'Agricultural labour', 'Horticulture', 'Non-agricultural labour'];
  const wageData = useMemo(
    () =>
      buildTrendData(
        {
          Construction: rows.wageConstruction,
          'Agricultural labour': rows.wageAgricultural,
          Horticulture: rows.wageHorticulture,
          'Non-agricultural labour': rows.wageNonAgricultural,
        },
        state
      ),
    [rows, state]
  );

  const empty = !loading && !hasAnyValue(inflationData, inflationKeys) && !hasAnyValue(wageData, wageKeys);

  return (
    <SectionCard
      title="2 · Price and Wages"
      description="Consumer price inflation by category, and rural daily wage rates across occupations, for the selected state."
      loading={loading}
      error={error}
      empty={empty}
      stateName={state}
    >
      <ChartGrid>
        <ChartBlock title="Inflation by category (CPI, % YoY)">
          <TrendChart
            data={inflationData}
            series={[
              { key: 'General', label: 'General', color: colors.categorical[0] },
              { key: 'Food & beverages', label: 'Food & beverages', color: colors.categorical[1] },
              { key: 'Fuel & light', label: 'Fuel & light', color: colors.categorical[4] },
              { key: 'Housing (urban)', label: 'Housing (urban)', color: colors.categorical[5] },
            ]}
            yFormatter={pct1}
            colors={colors}
            title="Inflation by category (CPI, % YoY)"
          />
        </ChartBlock>
        <ChartBlock title="Rural daily wage rates (₹/day)">
          <TrendChart
            data={wageData}
            series={[
              { key: 'Construction', label: 'Construction', color: colors.categorical[2] },
              { key: 'Agricultural labour', label: 'Agricultural labour', color: colors.categorical[3] },
              { key: 'Horticulture', label: 'Horticulture', color: colors.categorical[6] },
              { key: 'Non-agricultural labour', label: 'Non-agricultural labour', color: colors.categorical[7] },
            ]}
            yFormatter={formatInr}
            colors={colors}
            title="Rural daily wage rates (₹/day)"
          />
        </ChartBlock>
      </ChartGrid>
    </SectionCard>
  );
};

export default PriceWagesProfileSection;
