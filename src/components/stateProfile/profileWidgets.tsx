import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  TooltipContentProps,
  DefaultLegendContentProps,
} from 'recharts';
import './profileWidgets.css';

// ─────────────────────────────────────────────────────────────────────────────
//  Shared building blocks for the State Profile page — a stat-tile row, a
//  compact multi-line trend chart, and a compact grouped/comparison bar
//  chart — plus the small data-shaping helpers every section needs
//  (filter-by-state, latest-value, per-period pivoting). Kept in one module
//  so the six dataset sections don't each re-implement the same Tooltip /
//  Legend / empty-state boilerplate.
// ─────────────────────────────────────────────────────────────────────────────

export interface MetricRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

// ── Data-shaping helpers ─────────────────────────────────────────────────────

export const rowsForState = (rows: MetricRow[], state: string): MetricRow[] =>
  rows.filter((r) => r.dimension_name === state);

export const latestForState = (rows: MetricRow[], state: string): { period: string; value: number } | null => {
  const stateRows = rowsForState(rows, state)
    .slice()
    .sort((a, b) => a.period.localeCompare(b.period));
  if (!stateRows.length) return null;
  const last = stateRows[stateRows.length - 1];
  return { period: last.period, value: last.value };
};

// Fetch every metric in a {camelCaseKey: metric_id} map in parallel, keyed by
// the same camelCase names — avoids re-typing a long Promise.all destructure
// per section when a dataset has a dozen-plus metrics.
export const fetchMetricRows = async (
  fetchFn: (metricId: number) => Promise<MetricRow[]>,
  metricIds: Record<string, number>
): Promise<Record<string, MetricRow[]>> => {
  const keys = Object.keys(metricIds);
  const results = await Promise.all(keys.map((k) => fetchFn(metricIds[k])));
  const out: Record<string, MetricRow[]> = {};
  keys.forEach((k, i) => {
    out[k] = results[i];
  });
  return out;
};

// Build one row per period, one column per named series, restricted to a
// single state — the shape LineChart/BarChart expect.
export const buildTrendData = (
  seriesRowsByLabel: Record<string, MetricRow[] | undefined>,
  state: string
): Record<string, number | string>[] => {
  const byPeriod = new Map<string, Record<string, number | string>>();
  Object.entries(seriesRowsByLabel).forEach(([label, rows]) => {
    rowsForState(rows ?? [], state).forEach((r) => {
      if (!byPeriod.has(r.period)) byPeriod.set(r.period, { period: r.period });
      (byPeriod.get(r.period) as Record<string, number | string>)[label] = r.value;
    });
  });
  return Array.from(byPeriod.values()).sort((a, b) => String(a.period).localeCompare(String(b.period)));
};

export const hasAnyValue = (data: Record<string, number | string>[], keys: string[]): boolean =>
  data.some((row) => keys.some((k) => row[k] != null));

// Build one row per period, one column per named STATE, out of a single
// metric's rows spanning every state — the mirror image of buildTrendData
// (which pivots one state's rows by metric). Used by Compare States, where
// there's exactly one metric but many states to plot side by side.
export const buildTrendDataByState = (
  rows: MetricRow[],
  states: string[]
): Record<string, number | string>[] => {
  const byPeriod = new Map<string, Record<string, number | string>>();
  const wanted = new Set(states);
  rows.forEach((r) => {
    if (!wanted.has(r.dimension_name)) return;
    if (!byPeriod.has(r.period)) byPeriod.set(r.period, { period: r.period });
    (byPeriod.get(r.period) as Record<string, number | string>)[r.dimension_name] = r.value;
  });
  return Array.from(byPeriod.values()).sort((a, b) => String(a.period).localeCompare(String(b.period)));
};

// ── Stat tile row ────────────────────────────────────────────────────────────

export interface StatTile {
  label: string;
  value: string;
  hint?: string;
}

export const StatTileRow: React.FC<{ tiles: StatTile[] }> = ({ tiles }) => (
  <div className="state-profile-stats">
    {tiles.map((tile) => (
      <div className="state-profile-stat-tile" key={tile.label}>
        <span className="state-profile-stat-label">{tile.label}</span>
        <span className="state-profile-stat-value">{tile.value}</span>
        {tile.hint && <span className="state-profile-stat-hint">{tile.hint}</span>}
      </div>
    ))}
  </div>
);

// ── Section card (title/description + loading/error/empty states) ──────────

export const SectionCard: React.FC<{
  title: string;
  description: string;
  loading: boolean;
  error: string | null;
  empty: boolean;
  stateName: string;
  children: React.ReactNode;
}> = ({ title, description, loading, error, empty, stateName, children }) => (
  <div className="state-profile-section">
    <h2 className="state-profile-section-title">{title}</h2>
    <p className="state-profile-section-desc">{description}</p>
    {error && <div className="state-profile-section-error">{error}</div>}
    {!error && loading && <div className="state-profile-section-empty">Loading…</div>}
    {!error && !loading && empty && (
      <div className="state-profile-section-empty">No data for {stateName} in this dataset.</div>
    )}
    {!error && !loading && !empty && children}
  </div>
);

export const ChartGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="state-profile-chart-grid">{children}</div>
);

export const ChartBlock: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="state-profile-chart-block">
    <h4 className="state-profile-chart-title">{title}</h4>
    {children}
  </div>
);

// ── Tooltip / Legend (generic — takes a value formatter) ────────────────────

const makeTooltip = (valueFormatter: (v: number) => string): React.FC<TooltipContentProps> => {
  const TooltipComp: React.FC<TooltipContentProps> = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="state-profile-tooltip">
        <div className="state-profile-tooltip-period">{label}</div>
        {payload.map((entry) => (
          <div className="state-profile-tooltip-row" key={String(entry.dataKey)}>
            <span className="state-profile-tooltip-key" style={{ background: entry.color }} />
            <span className="state-profile-tooltip-name">{String(entry.name ?? entry.dataKey)}</span>
            <span className="state-profile-tooltip-value">
              {entry.value == null ? '—' : valueFormatter(Number(entry.value))}
            </span>
          </div>
        ))}
      </div>
    );
  };
  return TooltipComp;
};

const ProfileLegend: React.FC<DefaultLegendContentProps> = ({ payload }) => {
  if (!payload) return null;
  return (
    <div className="state-profile-legend">
      {payload.map((entry) => (
        <span className="state-profile-legend-item" key={String(entry.dataKey)}>
          <span className="state-profile-legend-dot" style={{ background: entry.color }} />
          {entry.value}
        </span>
      ))}
    </div>
  );
};

export interface ChartSeriesDef {
  key: string;
  label: string;
  color: string;
}

interface ReferenceLineDef {
  y: number;
  label: string;
  color: string;
}

interface PaletteSubset {
  grid: string;
  axisText: string;
  surface: string;
}

// ── Compact multi-line trend chart ───────────────────────────────────────────

interface TrendChartProps {
  data: Record<string, number | string>[];
  series: ChartSeriesDef[];
  yFormatter?: (v: number) => string;
  height?: number;
  colors: PaletteSubset;
  referenceLines?: ReferenceLineDef[];
  // Off by default only for callers that already show state/series identity
  // another way (e.g. colored chips) and would otherwise show it twice.
  showLegend?: boolean;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  series,
  yFormatter = (v) => String(v),
  height = 240,
  colors,
  referenceLines,
  showLegend = true,
}) => {
  const TooltipContent = makeTooltip(yFormatter);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={colors.grid} vertical={false} />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 11, fill: colors.axisText }}
          axisLine={{ stroke: colors.grid }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: colors.axisText }}
          axisLine={{ stroke: colors.grid }}
          tickLine={false}
          tickFormatter={yFormatter}
          width={60}
        />
        <Tooltip content={(props) => <TooltipContent {...props} />} />
        {showLegend && <Legend content={(props) => <ProfileLegend {...props} />} />}
        {(referenceLines ?? []).map((rl) => (
          <ReferenceLine
            key={rl.label}
            y={rl.y}
            stroke={rl.color}
            strokeDasharray="4 4"
            label={{ value: rl.label, position: 'insideTopRight', fill: rl.color, fontSize: 11 }}
          />
        ))}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 2.5, fill: s.color, stroke: colors.surface, strokeWidth: 1 }}
            activeDot={{ r: 4, fill: s.color, stroke: colors.surface, strokeWidth: 1 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

// ── Compact grouped / comparison bar chart ───────────────────────────────────

export interface BarCategoryRow {
  category: string;
  [seriesKey: string]: number | string | null | undefined;
}

interface ComparisonBarChartProps {
  data: BarCategoryRow[];
  series: ChartSeriesDef[];
  yFormatter?: (v: number) => string;
  height?: number;
  colors: PaletteSubset;
  referenceLines?: ReferenceLineDef[];
}

export const ComparisonBarChart: React.FC<ComparisonBarChartProps> = ({
  data,
  series,
  yFormatter = (v) => String(v),
  height = 240,
  colors,
  referenceLines,
}) => {
  const TooltipContent = makeTooltip(yFormatter);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={colors.grid} vertical={false} />
        <XAxis
          dataKey="category"
          tick={{ fontSize: 11.5, fill: colors.axisText }}
          axisLine={{ stroke: colors.grid }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: colors.axisText }}
          axisLine={{ stroke: colors.grid }}
          tickLine={false}
          tickFormatter={yFormatter}
          width={52}
        />
        <Tooltip content={(props) => <TooltipContent {...props} />} />
        <Legend content={(props) => <ProfileLegend {...props} />} />
        {(referenceLines ?? []).map((rl) => (
          <ReferenceLine
            key={rl.label}
            y={rl.y}
            stroke={rl.color}
            strokeDasharray="4 4"
            label={{ value: rl.label, position: 'insideTopRight', fill: rl.color, fontSize: 11 }}
          />
        ))}
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} activeBar={{ stroke: 'transparent' }} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

// ── Shared value formatters ──────────────────────────────────────────────────

export const pct1 = (v: number) => `${v.toFixed(1)}%`;
export const intFmt = (v: number) => `${Math.round(v)}`;
export const unitless2 = (v: number) => v.toFixed(2);
export const oneDecimal = (v: number) => v.toFixed(1);
