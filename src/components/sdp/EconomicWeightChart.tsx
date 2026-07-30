import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  TooltipContentProps,
  DefaultLegendContentProps,
} from 'recharts';
import { fetchSdpFinancialYearSeries, SDP_METRICS } from '../../api/stateDomesticProductApi';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import { ExpandableChart } from '../ExpandableChart';
import './EconomicWeightChart.css';

interface MetricRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

const TOP_N = 8;
const OTHER_KEY = 'All other States/UTs';

const EconomicWeightChart: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const PALETTE = colors.categorical;
  const OTHER_COLOR = colors.muted;
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSdpFinancialYearSeries(SDP_METRICS.gsdpCurrent)
      .then((data: MetricRow[]) => {
        if (cancelled) return;
        setRows(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load economic weight data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A state's most recent year isn't always the dataset's most recent year
  // (some haven't reported yet) — so plotting every period would make a
  // state that simply hasn't reported look like it lost all its share.
  // Instead, cap the chart at the latest period where the number of
  // reporting states matches the historical peak, i.e. the last "complete" year.
  const { cutoffPeriod, periods, stateCountByPeriod } = useMemo(() => {
    const countMap = new Map<string, number>();
    rows.forEach((r) => countMap.set(r.period, (countMap.get(r.period) ?? 0) + 1));
    const sortedPeriods = Array.from(countMap.keys()).sort();
    const maxCount = countMap.size ? Math.max(...Array.from(countMap.values())) : 0;
    let cutoff = '';
    for (let i = sortedPeriods.length - 1; i >= 0; i -= 1) {
      if (countMap.get(sortedPeriods[i]) === maxCount) {
        cutoff = sortedPeriods[i];
        break;
      }
    }
    return {
      cutoffPeriod: cutoff,
      periods: sortedPeriods.filter((p) => !cutoff || p <= cutoff),
      stateCountByPeriod: countMap,
      maxReportingCount: maxCount,
    };
  }, [rows]);

  const { top8, colorFor } = useMemo(() => {
    const cutoffRows = rows
      .filter((r) => r.period === cutoffPeriod)
      .sort((a, b) => b.value - a.value)
      .slice(0, TOP_N);
    const names = cutoffRows.map((r) => r.dimension_name);
    const colors: Record<string, string> = {};
    names.forEach((name, i) => {
      colors[name] = PALETTE[i % PALETTE.length];
    });
    colors[OTHER_KEY] = OTHER_COLOR;
    return { top8: names, colorFor: colors };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cutoffPeriod, theme]);

  const { chartData, periodTotals } = useMemo(() => {
    const byPeriod = new Map<string, Map<string, number>>();
    rows.forEach((r) => {
      if (!periods.includes(r.period)) return;
      if (!byPeriod.has(r.period)) byPeriod.set(r.period, new Map());
      byPeriod.get(r.period)!.set(r.dimension_name, r.value);
    });

    const totals: Record<string, number> = {};
    const data = periods.map((period) => {
      const stateValues = byPeriod.get(period) ?? new Map<string, number>();
      const total = Array.from(stateValues.values()).reduce((sum, v) => sum + v, 0);
      totals[period] = total;

      const row: Record<string, number | string> = { period };
      let top8Sum = 0;
      top8.forEach((name) => {
        const v = stateValues.get(name) ?? 0;
        row[name] = v;
        top8Sum += v;
      });
      row[OTHER_KEY] = Math.max(total - top8Sum, 0);
      return row;
    });

    return { chartData: data, periodTotals: totals };
  }, [rows, periods, top8]);

  const hasTruncatedYears = Array.from(stateCountByPeriod.keys()).some((p) => p > cutoffPeriod);

  return (
    <div className="economic-weight">
      <h3 className="economic-weight-title">4 · Economic Weight Shift</h3>
      <p className="economic-weight-desc">
        A stacked area chart of each state's share of aggregate GSDP shows composition, not just growth —
        whether the biggest economies are pulling further ahead or losing ground to the rest.
      </p>

      {error && <div className="economic-weight-error">{error}</div>}

      {!error && (loading || chartData.length === 0) && (
        <div className="economic-weight-empty">
          {loading ? 'Loading economic weight data…' : 'Not enough data to chart.'}
        </div>
      )}

      {!error && !loading && chartData.length > 0 && (
        <>
          <ExpandableChart title="4 · Economic Weight Shift" height={420} className="economic-weight-chart">
            {(h) => (
              <ResponsiveContainer width="100%" height={h}>
                <AreaChart data={chartData} stackOffset="expand" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid stroke={colors.grid} vertical={false} />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 12, fill: colors.axisText }}
                    axisLine={{ stroke: colors.grid }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: colors.axisText }}
                    axisLine={{ stroke: colors.grid }}
                    tickLine={false}
                    tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                  />
                  <Tooltip
                    content={(props) => <EconomicWeightTooltip {...props} periodTotals={periodTotals} />}
                  />
                  <Legend content={(props) => <EconomicWeightLegend {...props} colorFor={colorFor} />} />
                  {top8.map((name) => (
                    <Area
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stackId="share"
                      stroke={colorFor[name]}
                      fill={colorFor[name]}
                      fillOpacity={0.85}
                    />
                  ))}
                  <Area
                    type="monotone"
                    dataKey={OTHER_KEY}
                    stackId="share"
                    stroke={OTHER_COLOR}
                    fill={OTHER_COLOR}
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ExpandableChart>
          <div className="economic-weight-footnote">
            Top {TOP_N} states by {cutoffPeriod} GSDP shown individually; everyone else grouped as "{OTHER_KEY}".
            Capped at {cutoffPeriod}, the latest year with complete state-wise reporting
            {hasTruncatedYears ? ' — some states are not yet available for the years after it.' : '.'}
          </div>
        </>
      )}
    </div>
  );
};

const EconomicWeightTooltip: React.FC<TooltipContentProps & { periodTotals: Record<string, number> }> = ({
  active,
  payload,
  label,
  periodTotals,
}) => {
  if (!active || !payload || !payload.length) return null;
  const total = periodTotals[String(label)] || 0;
  const sorted = [...payload].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));

  return (
    <div className="economic-weight-tooltip">
      <div className="economic-weight-tooltip-period">{label}</div>
      {sorted.map((entry) => {
        const raw = Number(entry.value) || 0;
        const pct = total > 0 ? (raw / total) * 100 : 0;
        return (
          <div className="economic-weight-tooltip-row" key={String(entry.dataKey)}>
            <span className="economic-weight-tooltip-key" style={{ background: entry.color }} />
            <span className="economic-weight-tooltip-name">{String(entry.dataKey)}</span>
            <span className="economic-weight-tooltip-value">{pct.toFixed(1)}%</span>
          </div>
        );
      })}
    </div>
  );
};

const EconomicWeightLegend: React.FC<DefaultLegendContentProps & { colorFor: Record<string, string> }> = ({
  payload,
}) => {
  if (!payload) return null;
  return (
    <div className="economic-weight-legend">
      {payload.map((entry) => (
        <span className="economic-weight-legend-item" key={String(entry.dataKey)}>
          <span className="economic-weight-legend-dot" style={{ background: entry.color }} />
          {entry.value}
        </span>
      ))}
    </div>
  );
};

export default EconomicWeightChart;
