import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  TooltipContentProps,
  DefaultLegendContentProps,
} from 'recharts';
import { fetchSdpFinancialYearSeries, SDP_METRICS } from '../../api/stateDomesticProductApi';
import { formatInrShort } from '../../utils/format';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS, RANK_GRADIENT } from '../../theme/chartColors';
import StateSearchSelect from './StateSearchSelect';
import './RealVsNominalChart.css';

interface MetricRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

type Aggregate = 'gross' | 'net';

const AGGREGATE_METRICS: Record<Aggregate, { current: number; constant: number; label: string }> = {
  gross: { current: SDP_METRICS.gsdpCurrent, constant: SDP_METRICS.gsdpConstant, label: 'Gross SDP' },
  net: { current: SDP_METRICS.nsdpCurrent, constant: SDP_METRICS.nsdpConstant, label: 'Net SDP' },
};

const RealVsNominalChart: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const NOMINAL_COLOR = RANK_GRADIENT[theme].light; // light green
  const REAL_COLOR = RANK_GRADIENT[theme].dark; // dark green
  const [aggregate, setAggregate] = useState<Aggregate>('gross');
  const [selectedState, setSelectedState] = useState<string>('');
  const [currentRows, setCurrentRows] = useState<MetricRow[]>([]);
  const [constantRows, setConstantRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const { current, constant } = AGGREGATE_METRICS[aggregate];
    Promise.all([fetchSdpFinancialYearSeries(current), fetchSdpFinancialYearSeries(constant)])
      .then(([currentData, constantData]: [MetricRow[], MetricRow[]]) => {
        if (cancelled) return;
        setCurrentRows(currentData);
        setConstantRows(constantData);
        const names = Array.from(new Set(currentData.map((r) => r.dimension_name))).sort((a, b) =>
          a.localeCompare(b)
        );
        setSelectedState((prev) => (prev && names.includes(prev) ? prev : names[0] ?? ''));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load real vs nominal data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [aggregate]);

  const availableStates = useMemo(
    () => Array.from(new Set(currentRows.map((r) => r.dimension_name))).sort((a, b) => a.localeCompare(b)),
    [currentRows]
  );

  const { chartData, avgGapPct, basePeriod } = useMemo(() => {
    const currentByPeriod = new Map(
      currentRows.filter((r) => r.dimension_name === selectedState).map((r) => [r.period, r.value])
    );
    const constantByPeriod = new Map(
      constantRows.filter((r) => r.dimension_name === selectedState).map((r) => [r.period, r.value])
    );
    const periods = Array.from(currentByPeriod.keys())
      .filter((p) => constantByPeriod.has(p))
      .sort();

    const data = periods.map((period) => {
      const current = currentByPeriod.get(period) as number;
      const constant = constantByPeriod.get(period) as number;
      return {
        period,
        current,
        constant,
        gapRange: [Math.min(current, constant), Math.max(current, constant)] as [number, number],
      };
    });

    const gapPcts = data
      .filter((d) => d.constant > 0)
      .map((d) => ((d.current - d.constant) / d.constant) * 100);
    const avgGap = gapPcts.length ? gapPcts.reduce((sum, v) => sum + v, 0) / gapPcts.length : null;

    const allPeriods = Array.from(new Set(currentRows.map((r) => r.period))).sort();

    return { chartData: data, avgGapPct: avgGap, basePeriod: allPeriods[0] ?? '' };
  }, [currentRows, constantRows, selectedState]);

  const aggregateLabel = AGGREGATE_METRICS[aggregate].label;

  return (
    <div className="real-vs-nominal">
      <h3 className="real-vs-nominal-title">5 · Real vs Nominal Gap</h3>
      <p className="real-vs-nominal-desc">
        Plotting current and constant price series for the same state together, with the gap between them
        shaded, visualises how much of a state's headline "growth" is just price rise rather than real
        output.
      </p>

      <div className="real-vs-nominal-controls">
        <div className="control">
          <span className="control-label">State</span>
          <StateSearchSelect states={availableStates} value={selectedState} onChange={setSelectedState} />
        </div>

        <div className="control">
          <span className="control-label">Aggregate</span>
          <div className="aggregate-toggle" role="radiogroup">
            {(Object.keys(AGGREGATE_METRICS) as Aggregate[]).map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={aggregate === key}
                className={`aggregate-option${aggregate === key ? ' active' : ''}`}
                onClick={() => setAggregate(key)}
              >
                <span className="aggregate-dot" />
                {AGGREGATE_METRICS[key].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="real-vs-nominal-error">{error}</div>}

      {!error && (loading || chartData.length === 0) && (
        <div className="real-vs-nominal-empty">
          {loading ? 'Loading…' : 'No overlapping current/constant data for this state.'}
        </div>
      )}

      {!error && !loading && chartData.length > 0 && (
        <>
          <div className="real-vs-nominal-chart">
            <ResponsiveContainer width="100%" height={380}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="realVsNominalGapGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NOMINAL_COLOR} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={REAL_COLOR} stopOpacity={0.12} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={colors.grid} />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11, fill: colors.axisText }}
                  axisLine={{ stroke: colors.grid }}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={16}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: colors.axisText }}
                  axisLine={{ stroke: colors.grid }}
                  tickLine={false}
                  tickFormatter={(v: number) => formatInrShort(v)}
                  width={56}
                />
                <Tooltip content={(props) => <RealVsNominalTooltip {...props} />} />
                <Legend content={(props) => <RealVsNominalLegend {...props} />} />
                <Area
                  dataKey="gapRange"
                  stroke="none"
                  fill="url(#realVsNominalGapGradient)"
                  isAnimationActive={false}
                  legendType="none"
                  tooltipType="none"
                />
                <Line
                  type="monotone"
                  dataKey="constant"
                  name="Constant prices (real)"
                  stroke={REAL_COLOR}
                  strokeWidth={2}
                  dot={{ r: 3, fill: REAL_COLOR, stroke: colors.surface, strokeWidth: 1.5 }}
                />
                <Line
                  type="monotone"
                  dataKey="current"
                  name="Current prices (nominal)"
                  stroke={NOMINAL_COLOR}
                  strokeWidth={2}
                  dot={{ r: 3, fill: NOMINAL_COLOR, stroke: colors.surface, strokeWidth: 1.5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="real-vs-nominal-footnote">
            {selectedState}: average gap between nominal and real {aggregateLabel} across available years ≈{' '}
            {avgGapPct !== null ? `${avgGapPct.toFixed(1)}%` : '—'} — a rough proxy for cumulative
            price-level change (deflator) versus the {basePeriod} base.
          </div>
        </>
      )}
    </div>
  );
};

const RealVsNominalTooltip: React.FC<TooltipContentProps> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const lines = payload.filter((entry) => entry.dataKey === 'current' || entry.dataKey === 'constant');
  return (
    <div className="real-vs-nominal-tooltip">
      <div className="real-vs-nominal-tooltip-period">{label}</div>
      {lines.map((entry) => (
        <div className="real-vs-nominal-tooltip-row" key={String(entry.dataKey)}>
          <span className="real-vs-nominal-tooltip-key" style={{ background: entry.color }} />
          <span className="real-vs-nominal-tooltip-value">{formatInrShort(Number(entry.value))}</span>
          <span className="real-vs-nominal-tooltip-name">{entry.name}</span>
        </div>
      ))}
    </div>
  );
};

const RealVsNominalLegend: React.FC<DefaultLegendContentProps> = ({ payload }) => {
  if (!payload) return null;
  return (
    <div className="real-vs-nominal-legend">
      {payload
        .filter((entry) => entry.value === 'Current prices (nominal)' || entry.value === 'Constant prices (real)')
        .map((entry) => (
          <span className="real-vs-nominal-legend-item" key={String(entry.dataKey)}>
            <span className="real-vs-nominal-legend-dot" style={{ background: entry.color }} />
            {entry.value}
          </span>
        ))}
    </div>
  );
};

export default RealVsNominalChart;
