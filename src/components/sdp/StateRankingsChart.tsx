import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  TooltipContentProps,
} from 'recharts';
import { fetchSdpFinancialYearSeries, SDP_METRICS } from '../../api/stateDomesticProductApi';
import { formatInrShort } from '../../utils/format';
import { rankColor } from '../../utils/rankColor';
import { useTheme, ThemeMode } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import './StateRankingsChart.css';

interface MetricRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

const METRIC_OPTIONS = [
  { id: SDP_METRICS.perCapitaCurrent, label: 'Per-Capita NSDP — Current Prices' },
  { id: SDP_METRICS.perCapitaConstant, label: 'Per-Capita NSDP — Constant Prices' },
  { id: SDP_METRICS.gsdpCurrent, label: 'Gross SDP — Current Prices' },
  { id: SDP_METRICS.gsdpConstant, label: 'Gross SDP — Constant Prices' },
  { id: SDP_METRICS.nsdpCurrent, label: 'Net SDP — Current Prices' },
  { id: SDP_METRICS.nsdpConstant, label: 'Net SDP — Constant Prices' },
];

type ShowMode = 'top15' | 'bottom15' | 'all';

const StateRankingsChart: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const [metricId, setMetricId] = useState<number>(SDP_METRICS.perCapitaCurrent);
  const [year, setYear] = useState<string>('');
  const [show, setShow] = useState<ShowMode>('top15');
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSdpFinancialYearSeries(metricId)
      .then((data: MetricRow[]) => {
        if (cancelled) return;
        setRows(data);
        const years = Array.from(new Set(data.map((r) => r.period))).sort();
        setYear((prev) => (prev && years.includes(prev) ? prev : years[years.length - 1] ?? ''));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load state rankings data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [metricId]);

  const availableYears = useMemo(
    () => Array.from(new Set(rows.map((r) => r.period))).sort().reverse(),
    [rows]
  );

  const yearRows = useMemo(
    () => rows.filter((r) => r.period === year).sort((a, b) => b.value - a.value),
    [rows, year]
  );

  const displayRows = useMemo(() => {
    if (show === 'top15') return yearRows.slice(0, 15);
    if (show === 'bottom15') return [...yearRows.slice(-15)].sort((a, b) => b.value - a.value);
    return yearRows;
  }, [yearRows, show]);

  const metricLabel = METRIC_OPTIONS.find((m) => m.id === metricId)?.label ?? '';

  const showOptions: { id: ShowMode; label: string }[] = [
    { id: 'top15', label: 'Top 15' },
    { id: 'bottom15', label: 'Bottom 15' },
    { id: 'all', label: `All (${yearRows.length})` },
  ];

  return (
    <div className="state-rankings">
      <h3 className="state-rankings-title">2 · State Rankings</h3>
      <p className="state-rankings-desc">
        A sorted horizontal bar chart shows which state leads for any single year and metric — per-capita
        income, or the overall size of a state's economy.
      </p>

      <div className="state-rankings-controls">
        <div className="control">
          <span className="control-label">Year</span>
          <select className="control-select" value={year} onChange={(e) => setYear(e.target.value)}>
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="control">
          <span className="control-label">Metric</span>
          <select
            className="control-select"
            value={metricId}
            onChange={(e) => setMetricId(Number(e.target.value))}
          >
            {METRIC_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="control">
          <span className="control-label">Show</span>
          <div className="show-toggle" role="radiogroup">
            {showOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={show === opt.id}
                className={`show-option${show === opt.id ? ' active' : ''}`}
                onClick={() => setShow(opt.id)}
              >
                <span className="show-dot" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="state-rankings-error">{error}</div>}

      {!error && (loading || displayRows.length === 0) && (
        <div className="state-rankings-empty">
          {loading ? 'Loading state rankings…' : 'No data for this year/metric.'}
        </div>
      )}

      {!error && !loading && displayRows.length > 0 && (
        <>
          <div className="state-rankings-chart" style={{ height: Math.max(displayRows.length * 32, 120) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={displayRows}
                layout="vertical"
                margin={{ top: 4, right: 70, left: 8, bottom: 4 }}
                barCategoryGap={6}
              >
                <CartesianGrid stroke={colors.grid} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: colors.axisText }}
                  axisLine={{ stroke: colors.grid }}
                  tickLine={false}
                  tickFormatter={(v: number) => formatInrShort(v)}
                />
                <YAxis
                  type="category"
                  dataKey="dimension_name"
                  tick={{ fontSize: 12.5, fill: colors.ink }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <Tooltip
                  cursor={false}
                  content={(props) => <StateRankingsTooltip {...props} rows={displayRows} theme={theme} />}
                />
                <Bar dataKey="value" radius={2} maxBarSize={22} activeBar={{ stroke: 'transparent' }}>
                  {displayRows.map((row, index) => (
                    <Cell key={row.dimension_id} fill={rankColor(index, displayRows.length, theme)} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    formatter={(v: React.ReactNode) => formatInrShort(Number(v))}
                    style={{ fontSize: 11.5, fill: colors.axisText }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="state-rankings-footnote">
            {metricLabel} · {year} · {displayRows.length} of {yearRows.length} states/UTs with data shown
          </div>
        </>
      )}
    </div>
  );
};

const StateRankingsTooltip: React.FC<TooltipContentProps & { rows: MetricRow[]; theme: ThemeMode }> = ({
  active,
  payload,
  rows,
  theme,
}) => {
  if (!active || !payload || !payload.length) return null;
  const dimensionId = payload[0]?.payload?.dimension_id as number | undefined;
  const rowIndex = rows.findIndex((r) => r.dimension_id === dimensionId);
  const row = rows[rowIndex];
  if (!row) return null;

  return (
    <div className="state-rankings-tooltip">
      <span className="state-rankings-tooltip-key" style={{ background: rankColor(rowIndex, rows.length, theme) }} />
      <span className="state-rankings-tooltip-name">{row.dimension_name}</span>
      <span className="state-rankings-tooltip-value">{formatInrShort(row.value)}</span>
    </div>
  );
};

export default StateRankingsChart;
