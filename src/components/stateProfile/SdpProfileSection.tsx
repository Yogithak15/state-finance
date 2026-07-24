import React, { useEffect, useMemo, useState } from 'react';
import { fetchSdpFinancialYearSeries, SDP_METRICS } from '../../api/stateDomesticProductApi';
import { formatInrShort } from '../../utils/format';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import {
  MetricRow,
  SectionCard,
  ChartGrid,
  ChartBlock,
  StatTileRow,
  TrendChart,
  buildTrendData,
  latestForState,
  hasAnyValue,
  fetchMetricRows,
} from './profileWidgets';

interface Props {
  state: string;
}

const SdpProfileSection: React.FC<Props> = ({ state }) => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];

  const [rows, setRows] = useState<Record<string, MetricRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchMetricRows(fetchSdpFinancialYearSeries, SDP_METRICS)
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load State Domestic Product data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentData = useMemo(
    () =>
      buildTrendData(
        { 'GSDP (current prices)': rows.gsdpCurrent, 'NSDP (current prices)': rows.nsdpCurrent },
        state
      ),
    [rows, state]
  );
  const constantData = useMemo(
    () =>
      buildTrendData(
        { 'GSDP (constant prices)': rows.gsdpConstant, 'NSDP (constant prices)': rows.nsdpConstant },
        state
      ),
    [rows, state]
  );

  const perCapitaCurrentLatest = latestForState(rows.perCapitaCurrent ?? [], state);
  const perCapitaConstantLatest = latestForState(rows.perCapitaConstant ?? [], state);

  const empty =
    !loading &&
    !hasAnyValue(currentData, ['GSDP (current prices)', 'NSDP (current prices)']) &&
    !hasAnyValue(constantData, ['GSDP (constant prices)', 'NSDP (constant prices)']) &&
    !perCapitaCurrentLatest &&
    !perCapitaConstantLatest;

  return (
    <SectionCard
      title="1 · State Domestic Product"
      description="Output and income levels for the state, in both current and inflation-adjusted (constant) prices."
      loading={loading}
      error={error}
      empty={empty}
      stateName={state}
    >
      <StatTileRow
        tiles={[
          {
            label: 'Per-Capita NSDP (current prices)',
            value: perCapitaCurrentLatest ? formatInrShort(perCapitaCurrentLatest.value) : '—',
            hint: perCapitaCurrentLatest ? `FY ${perCapitaCurrentLatest.period}` : 'No data',
          },
          {
            label: 'Per-Capita NSDP (constant prices)',
            value: perCapitaConstantLatest ? formatInrShort(perCapitaConstantLatest.value) : '—',
            hint: perCapitaConstantLatest ? `FY ${perCapitaConstantLatest.period}` : 'No data',
          },
        ]}
      />
      <ChartGrid>
        <ChartBlock title="GSDP & NSDP over time (current prices)">
          <TrendChart
            data={currentData}
            series={[
              { key: 'GSDP (current prices)', label: 'GSDP', color: colors.categorical[0] },
              { key: 'NSDP (current prices)', label: 'NSDP', color: colors.categorical[1] },
            ]}
            yFormatter={formatInrShort}
            colors={colors}
          />
        </ChartBlock>
        <ChartBlock title="GSDP & NSDP over time (constant prices)">
          <TrendChart
            data={constantData}
            series={[
              { key: 'GSDP (constant prices)', label: 'GSDP', color: colors.categorical[2] },
              { key: 'NSDP (constant prices)', label: 'NSDP', color: colors.categorical[3] },
            ]}
            yFormatter={formatInrShort}
            colors={colors}
          />
        </ChartBlock>
      </ChartGrid>
    </SectionCard>
  );
};

export default SdpProfileSection;
