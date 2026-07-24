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
import { rankColor } from '../../utils/rankColor';
import { useTheme, ThemeMode } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import './GrowthLeagueChart.css';

interface MetricRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

const METRIC_OPTIONS = [
  { id: SDP_METRICS.perCapitaConstant, label: 'Per-Capita NSDP (real)' },
  { id: SDP_METRICS.gsdpConstant, label: 'Gross SDP (real)' },
  { id: SDP_METRICS.nsdpConstant, label: 'Net SDP (real)' },
];

// Real-world inflection point (Covid onset) — a fixed historical anchor, not fetched data.
const COVID_PIVOT = '2019-20';

type PeriodMode = 'full' | 'pre-covid' | 'recovery';

const fyYear = (period: string) => Number(period.slice(0, 4));

const formatPct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`;

interface GrowthRow {
  dimensionId: number;
  state: string;
  displayLabel: string;
  cagr: number;
  startPeriod: string;
  endPeriod: string;
  approximate: boolean;
}

const GrowthLeagueChart: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const [metricId, setMetricId] = useState<number>(SDP_METRICS.perCapitaConstant);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('full');
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
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load growth league data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [metricId]);

  const byState = useMemo(() => {
    const map = new Map<number, { name: string; periods: MetricRow[] }>();
    rows.forEach((r) => {
      if (!map.has(r.dimension_id)) map.set(r.dimension_id, { name: r.dimension_name, periods: [] });
      map.get(r.dimension_id)!.periods.push(r);
    });
    map.forEach((entry) => entry.periods.sort((a, b) => a.period.localeCompare(b.period)));
    return map;
  }, [rows]);

  const globalStart = useMemo(() => {
    const periods = rows.map((r) => r.period);
    return periods.length ? periods.reduce((a, b) => (a < b ? a : b)) : '';
  }, [rows]);

  const globalEnd = useMemo(() => {
    const periods = rows.map((r) => r.period);
    return periods.length ? periods.reduce((a, b) => (a > b ? a : b)) : '';
  }, [rows]);

  const periodOptions: { id: PeriodMode; label: string }[] = useMemo(
    () => [
      { id: 'full', label: `${globalStart} → latest (full period, real CAGR)` },
      { id: 'pre-covid', label: `${globalStart} → ${COVID_PIVOT} (pre-Covid)` },
      { id: 'recovery', label: `${COVID_PIVOT} → latest (Covid recovery)` },
    ],
    [globalStart]
  );

  const growthRows = useMemo(() => {
    const nominalStart = periodMode === 'recovery' ? COVID_PIVOT : globalStart;
    const nominalEnd = periodMode === 'pre-covid' ? COVID_PIVOT : globalEnd;
    const result: GrowthRow[] = [];

    byState.forEach((entry, dimensionId) => {
      const periods = entry.periods;
      if (periods.length < 2) return;

      let startRow: MetricRow;
      let endRow: MetricRow;

      if (periodMode === 'full') {
        startRow = periods[0];
        endRow = periods[periods.length - 1];
      } else if (periodMode === 'pre-covid') {
        startRow = periods[0];
        endRow = [...periods].reverse().find((r) => r.period <= COVID_PIVOT) ?? periods[periods.length - 1];
      } else {
        startRow = periods.find((r) => r.period >= COVID_PIVOT) ?? periods[periods.length - 1];
        endRow = periods[periods.length - 1];
      }

      const years = fyYear(endRow.period) - fyYear(startRow.period);
      if (years <= 0 || startRow.value <= 0) return;

      const cagr = Math.pow(endRow.value / startRow.value, 1 / years) - 1;
      const approximate = startRow.period !== nominalStart || endRow.period !== nominalEnd;

      result.push({
        dimensionId,
        state: entry.name,
        displayLabel: approximate ? `${entry.name} *` : entry.name,
        cagr,
        startPeriod: startRow.period,
        endPeriod: endRow.period,
        approximate,
      });
    });

    return result.sort((a, b) => b.cagr - a.cagr);
  }, [byState, periodMode, globalStart, globalEnd]);

  const metricLabel = METRIC_OPTIONS.find((m) => m.id === metricId)?.label ?? '';

  return (
    <div className="growth-league">
      <h3 className="growth-league-title">3 · Growth League Table</h3>
      <p className="growth-league-desc">
        Ranking by compound annual growth rate (CAGR) turns raw levels into a growth story — who
        compounded fastest in real terms, and whether the post-Covid recovery reshuffled the order.
      </p>

      <div className="growth-league-controls">
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
          <span className="control-label">Period</span>
          <select
            className="control-select control-select-wide"
            value={periodMode}
            onChange={(e) => setPeriodMode(e.target.value as PeriodMode)}
          >
            {periodOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="growth-league-error">{error}</div>}

      {!error && (loading || growthRows.length === 0) && (
        <div className="growth-league-empty">
          {loading ? 'Loading growth league…' : 'No states have enough data for this period.'}
        </div>
      )}

      {!error && !loading && growthRows.length > 0 && (
        <div className="growth-league-chart" style={{ height: Math.max(growthRows.length * 26, 120) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={growthRows}
              layout="vertical"
              margin={{ top: 4, right: 60, left: 8, bottom: 4 }}
              barCategoryGap={4}
            >
              <CartesianGrid stroke={colors.grid} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: colors.axisText }}
                axisLine={{ stroke: colors.grid }}
                tickLine={false}
                tickFormatter={(v: number) => formatPct(v)}
              />
              <YAxis
                type="category"
                dataKey="displayLabel"
                tick={{ fontSize: 12, fill: colors.ink }}
                axisLine={false}
                tickLine={false}
                width={150}
              />
              <Tooltip
                cursor={false}
                content={(props) => <GrowthLeagueTooltip {...props} rows={growthRows} theme={theme} />}
              />
              <Bar dataKey="cagr" radius={2} maxBarSize={18} activeBar={{ stroke: 'transparent' }}>
                {growthRows.map((row, index) => (
                  <Cell key={row.dimensionId} fill={rankColor(index, growthRows.length, theme)} />
                ))}
                <LabelList
                  dataKey="cagr"
                  position="right"
                  formatter={(v: React.ReactNode) => formatPct(Number(v))}
                  style={{ fontSize: 11, fill: colors.axisText }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {!error && !loading && growthRows.some((r) => r.approximate) && (
        <div className="growth-league-footnote">
          * actual period used differs from the selected range — this state doesn't have data at both endpoints.
        </div>
      )}
    </div>
  );
};

const GrowthLeagueTooltip: React.FC<TooltipContentProps & { rows: GrowthRow[]; theme: ThemeMode }> = ({
  active,
  payload,
  rows,
  theme,
}) => {
  if (!active || !payload || !payload.length) return null;
  const displayLabel = payload[0]?.payload?.displayLabel as string | undefined;
  const rowIndex = rows.findIndex((r) => r.displayLabel === displayLabel);
  const row = rows[rowIndex];
  if (!row) return null;

  return (
    <div className="growth-league-tooltip">
      <div className="growth-league-tooltip-state">{row.state}</div>
      <div className="growth-league-tooltip-row">
        <span
          className="growth-league-tooltip-key"
          style={{ background: rankColor(rowIndex, rows.length, theme) }}
        />
        <span className="growth-league-tooltip-value">{formatPct(row.cagr)} CAGR</span>
        <span className="growth-league-tooltip-period">
          ({row.startPeriod}–{row.endPeriod})
        </span>
      </div>
    </div>
  );
};

export default GrowthLeagueChart;
