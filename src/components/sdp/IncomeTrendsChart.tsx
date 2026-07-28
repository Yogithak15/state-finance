import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
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
import { CHART_COLORS } from '../../theme/chartColors';
import './IncomeTrendsChart.css';

interface TrendRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

type PriceBasis = 'current' | 'constant';

const IncomeTrendsChart: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const PALETTE = colors.categorical;
  const [priceBasis, setPriceBasis] = useState<PriceBasis>('current');
  const [rows, setRows] = useState<TrendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const hasSetDefaultRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const metricId = priceBasis === 'current' ? SDP_METRICS.perCapitaCurrent : SDP_METRICS.perCapitaConstant;
    fetchSdpFinancialYearSeries(metricId)
      .then((data: TrendRow[]) => {
        if (cancelled) return;
        setRows(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load income trend data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [priceBasis]);

  const allStates = useMemo(
    () => Array.from(new Set(rows.map((r) => r.dimension_name))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  const filteredStates = useMemo(
    () => allStates.filter((name) => name.toLowerCase().includes(search.trim().toLowerCase())),
    [allStates, search]
  );

  // Pre-select a small, data-driven starting set (richest / median / least at
  // the latest available year) so the chart isn't empty on first load. Only
  // runs once — later refetches (e.g. toggling price basis) don't override
  // whatever the user has since picked.
  useEffect(() => {
    if (hasSetDefaultRef.current || rows.length === 0) return;
    const latestPeriod = rows.reduce((max, r) => (r.period > max ? r.period : max), '');
    const latestRows = rows.filter((r) => r.period === latestPeriod).sort((a, b) => b.value - a.value);
    if (latestRows.length === 0) return;

    const richest = latestRows[0];
    const least = latestRows[latestRows.length - 1];
    const median = latestRows[Math.floor(latestRows.length / 2)];
    const defaultNames = Array.from(new Set([richest, median, least].map((r) => r.dimension_name)));

    setSelected(defaultNames);
    setColorMap((cm) => {
      const next = { ...cm };
      defaultNames.forEach((name, i) => {
        next[name] = PALETTE[i % PALETTE.length];
      });
      return next;
    });
    hasSetDefaultRef.current = true;
  }, [rows, PALETTE]);

  const chartData = useMemo(() => {
    const byPeriod = new Map<string, Record<string, number | string>>();
    rows.forEach((r) => {
      if (!selected.includes(r.dimension_name)) return;
      if (!byPeriod.has(r.period)) byPeriod.set(r.period, { period: r.period });
      (byPeriod.get(r.period) as Record<string, number | string>)[r.dimension_name] = r.value;
    });
    return Array.from(byPeriod.values()).sort((a, b) => String(a.period).localeCompare(String(b.period)));
  }, [rows, selected]);

  // Colors are assigned per state on selection and freed on deselection, so an
  // existing line never repaints when a different state is added/removed.
  const toggleState = (name: string) => {
    setSelected((prev) => {
      if (prev.includes(name)) {
        setColorMap((cm) => {
          const next = { ...cm };
          delete next[name];
          return next;
        });
        return prev.filter((s) => s !== name);
      }
      setColorMap((cm) => {
        const used = new Set(Object.values(cm));
        const color = PALETTE.find((c) => !used.has(c)) ?? PALETTE[prev.length % PALETTE.length];
        return { ...cm, [name]: color };
      });
      return [...prev, name];
    });
  };

  const clearAll = () => {
    setSelected([]);
    setColorMap({});
  };

  return (
    <div className="income-trends">
      <h3 className="income-trends-title">1 · Income Trends over Time</h3>
      <p className="income-trends-desc">
        Per-capita net state domestic product across years, by state. Pick states to compare, and switch
        between current (nominal) and constant (inflation-adjusted) prices.
      </p>

      <div className="income-trends-control-group">
        <span className="income-trends-control-label">Price Basis</span>
        <div className="price-basis-toggle" role="radiogroup">
          {(['current', 'constant'] as PriceBasis[]).map((basis) => (
            <button
              key={basis}
              type="button"
              role="radio"
              aria-checked={priceBasis === basis}
              className={`price-basis-option${priceBasis === basis ? ' active' : ''}`}
              onClick={() => setPriceBasis(basis)}
            >
              <span className="price-basis-dot" />
              {basis === 'current' ? 'Current' : 'Constant'}
            </button>
          ))}
        </div>
      </div>

      <div className="income-trends-control-group">
        <div className="income-trends-control-header">
          <span className="income-trends-control-label">Search States</span>
          {selected.length > 0 && (
            <button type="button" className="clear-all-link" onClick={clearAll}>
              clear all
            </button>
          )}
        </div>
        <input
          type="text"
          className="state-search-input"
          placeholder="Type to filter…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="state-pill-grid">
          {filteredStates.map((name) => {
            const isSelected = selected.includes(name);
            return (
              <button
                key={name}
                type="button"
                className={`state-pill${isSelected ? ' selected' : ''}`}
                style={isSelected ? { background: colorMap[name], borderColor: colorMap[name] } : undefined}
                onClick={() => toggleState(name)}
              >
                {name}
              </button>
            );
          })}
          {!loading && filteredStates.length === 0 && (
            <span className="state-pill-empty">No states match “{search}”.</span>
          )}
        </div>
      </div>

      {error && <div className="income-trends-error">{error}</div>}

      {!error && selected.length === 0 && (
        <div className="income-trends-empty">
          {loading ? 'Loading states…' : 'Select one or more states above to see their income trend.'}
        </div>
      )}

      {!error && selected.length > 0 && (
        <div className="income-trends-chart">
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
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
                tick={(props: { y?: number | string; payload?: { value: number } }) => (
                  <LeftAlignedYAxisTick {...props} fill={colors.axisText} />
                )}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => formatInrShort(v)}
                width={44}
              />
              <Tooltip content={(props) => <IncomeTrendsTooltip {...props} />} />
              <Legend content={(props) => <IncomeTrendsLegend {...props} />} />
              {selected.map((name) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={colorMap[name]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: colorMap[name], stroke: colors.surface, strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: colorMap[name], stroke: colors.surface, strokeWidth: 2 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

// Left-aligned so every value starts flush at the card's left edge — same as
// the state pill labels above the chart — instead of recharts' default
// right-aligned ticks, which ragged-left differently-lengthed values.
const LeftAlignedYAxisTick: React.FC<{ y?: number | string; payload?: { value: number }; fill: string }> = ({
  y,
  payload,
  fill,
}) => (
  <text x={4} y={y} dy={4} fontSize={11} fill={fill} textAnchor="start">
    {formatInrShort(payload?.value ?? 0)}
  </text>
);

// Value leads (bold), state name follows, keyed by a short line — not a colored box.
const IncomeTrendsTooltip: React.FC<TooltipContentProps> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const sorted = [...payload].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  return (
    <div className="income-trends-tooltip">
      <div className="income-trends-tooltip-period">{label}</div>
      {sorted.map((entry) => (
        <div className="income-trends-tooltip-row" key={String(entry.dataKey)}>
          <span className="income-trends-tooltip-key" style={{ background: entry.color }} />
          <span className="income-trends-tooltip-value">{formatInrShort(Number(entry.value))}</span>
          <span className="income-trends-tooltip-name">{String(entry.dataKey)}</span>
        </div>
      ))}
    </div>
  );
};

// Dot + state name in text ink — identity never carried by colored text alone.
const IncomeTrendsLegend: React.FC<DefaultLegendContentProps> = ({ payload }) => {
  if (!payload) return null;
  return (
    <div className="income-trends-legend">
      {payload.map((entry) => (
        <span className="income-trends-legend-item" key={String(entry.dataKey)}>
          <span className="income-trends-legend-dot" style={{ background: entry.color }} />
          {entry.value}
        </span>
      ))}
    </div>
  );
};

export default IncomeTrendsChart;
