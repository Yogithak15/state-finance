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
import { fetchPwFinancialYearSeries, PW_METRICS } from '../../api/priceWagesApi';
import { formatInr } from '../../utils/format';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import { ExpandableChart } from '../ExpandableChart';
import './RuralWageRatesChart.css';

interface TrendRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

const ALL_INDIA_KEY = 'All-India';

const OCCUPATION_OPTIONS = [
  { id: PW_METRICS.wageConstruction, label: 'Construction' },
  { id: PW_METRICS.wageAgricultural, label: 'Agricultural Labour' },
  { id: PW_METRICS.wageHorticulture, label: 'Horticulture' },
  { id: PW_METRICS.wageNonAgricultural, label: 'Non-Agricultural Labour' },
];

const RuralWageRatesChart: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const PALETTE = colors.categorical;
  const [occupationId, setOccupationId] = useState<number>(PW_METRICS.wageConstruction);
  const [rows, setRows] = useState<TrendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const [showAverage, setShowAverage] = useState(true);
  const hasSetDefaultRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPwFinancialYearSeries(occupationId)
      .then((data: TrendRow[]) => {
        if (cancelled) return;
        setRows(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load rural wage rate data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [occupationId]);

  const allStates = useMemo(
    () => Array.from(new Set(rows.map((r) => r.dimension_name))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  const filteredStates = useMemo(
    () => allStates.filter((name) => name.toLowerCase().includes(search.trim().toLowerCase())),
    [allStates, search]
  );

  const yearRange = useMemo(() => {
    const periods = Array.from(new Set(rows.map((r) => r.period))).sort();
    return { start: periods[0] ?? '', end: periods[periods.length - 1] ?? '' };
  }, [rows]);

  // Pre-select a small, data-driven starting set (highest / median / lowest
  // wage at the latest available year). Only runs once — later occupation
  // switches don't override whatever the user has since picked.
  useEffect(() => {
    if (hasSetDefaultRef.current || rows.length === 0) return;
    const latestPeriod = rows.reduce((max, r) => (r.period > max ? r.period : max), '');
    const latestRows = rows.filter((r) => r.period === latestPeriod).sort((a, b) => b.value - a.value);
    if (latestRows.length === 0) return;

    const highest = latestRows[0];
    const lowest = latestRows[latestRows.length - 1];
    const median = latestRows[Math.floor(latestRows.length / 2)];
    const defaultNames = Array.from(new Set([highest, median, lowest].map((r) => r.dimension_name)));

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
      if (!byPeriod.has(r.period)) byPeriod.set(r.period, { period: r.period });
      if (selected.includes(r.dimension_name)) {
        (byPeriod.get(r.period) as Record<string, number | string>)[r.dimension_name] = r.value;
      }
    });

    if (showAverage) {
      const sums = new Map<string, { total: number; count: number }>();
      rows.forEach((r) => {
        const s = sums.get(r.period) ?? { total: 0, count: 0 };
        s.total += r.value;
        s.count += 1;
        sums.set(r.period, s);
      });
      byPeriod.forEach((entry, period) => {
        const s = sums.get(period);
        if (s && s.count > 0) entry[ALL_INDIA_KEY] = Math.round((s.total / s.count) * 100) / 100;
      });
    }

    return Array.from(byPeriod.values()).sort((a, b) => String(a.period).localeCompare(String(b.period)));
  }, [rows, selected, showAverage]);

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

  const occupationLabel = OCCUPATION_OPTIONS.find((o) => o.id === occupationId)?.label ?? '';
  const statesTracked = allStates.length;

  return (
    <div className="rural-wage">
      <h3 className="rural-wage-title">6 · Rural Daily Wage Rates</h3>
      <p className="rural-wage-desc">
        Average daily wage rates (₹) for four categories of rural labour, {yearRange.start} to{' '}
        {yearRange.end}. Coverage is narrower than the inflation tables — {statesTracked} major states
        report these series, plus an All-India average.
      </p>

      <div className="rural-wage-controls-row">
        <div className="rural-wage-control-group">
          <span className="rural-wage-control-label">Occupation</span>
          <div className="rural-wage-occupation-toggle" role="radiogroup">
            {OCCUPATION_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={occupationId === opt.id}
                className={`rural-wage-occupation-option${occupationId === opt.id ? ' active' : ''}`}
                onClick={() => setOccupationId(opt.id)}
              >
                <span className="rural-wage-occupation-dot" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rural-wage-control-group">
          <span className="rural-wage-control-label">Reference</span>
          <label className="rural-wage-all-india-toggle">
            <input type="checkbox" checked={showAverage} onChange={(e) => setShowAverage(e.target.checked)} />
            Show All-India average
          </label>
        </div>
      </div>

      <div className="rural-wage-control-group">
        <div className="rural-wage-control-header">
          <span className="rural-wage-control-label">Search States</span>
          {selected.length > 0 && (
            <button type="button" className="rural-wage-clear-all-link" onClick={clearAll}>
              clear all
            </button>
          )}
        </div>
        <input
          type="text"
          className="rural-wage-state-search-input"
          placeholder="Type to filter…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="rural-wage-state-pill-grid">
          {filteredStates.map((name) => {
            const isSelected = selected.includes(name);
            return (
              <button
                key={name}
                type="button"
                className={`rural-wage-state-pill${isSelected ? ' selected' : ''}`}
                style={isSelected ? { background: colorMap[name], borderColor: colorMap[name] } : undefined}
                onClick={() => toggleState(name)}
              >
                {name}
              </button>
            );
          })}
          {!loading && filteredStates.length === 0 && (
            <span className="rural-wage-state-pill-empty">No states match “{search}”.</span>
          )}
        </div>
      </div>

      {error && <div className="rural-wage-error">{error}</div>}

      {!error && selected.length === 0 && !showAverage && (
        <div className="rural-wage-empty">
          {loading ? 'Loading states…' : 'Select one or more states above to see their wage trend.'}
        </div>
      )}

      {!error && (selected.length > 0 || showAverage) && (
        <>
          <ExpandableChart title="6 · Rural Daily Wage Rates" height={380} className="rural-wage-chart">
            {(h) => (
            <ResponsiveContainer width="100%" height={h}>
              <LineChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid stroke={colors.grid} />
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
                  tickFormatter={(v: number) => formatInr(v)}
                  width={72}
                />
                <Tooltip content={(props) => <RuralWageTooltip {...props} />} />
                <Legend content={(props) => <RuralWageLegend {...props} />} />
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
                {showAverage && (
                  <Line
                    type="monotone"
                    dataKey={ALL_INDIA_KEY}
                    name={ALL_INDIA_KEY}
                    stroke={colors.ink}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={{ r: 3, fill: colors.ink, stroke: colors.surface, strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: colors.ink, stroke: colors.surface, strokeWidth: 2 }}
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
            )}
          </ExpandableChart>
          <div className="rural-wage-footnote">
            {occupationLabel} Workers (Men) · average daily wage, {yearRange.start} to {yearRange.end}.
            Yearly figures are averaged from monthly data; gaps mean too few wage quotations were reported
            that state/year (most common for horticulture).
          </div>
        </>
      )}
    </div>
  );
};

const RuralWageTooltip: React.FC<TooltipContentProps> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const sorted = [...payload].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  return (
    <div className="rural-wage-tooltip">
      <div className="rural-wage-tooltip-period">{label}</div>
      {sorted.map((entry) => (
        <div className="rural-wage-tooltip-row" key={String(entry.dataKey)}>
          <span className="rural-wage-tooltip-key" style={{ background: entry.color }} />
          <span className="rural-wage-tooltip-value">{formatInr(Number(entry.value))}</span>
          <span className="rural-wage-tooltip-name">{String(entry.dataKey)}</span>
        </div>
      ))}
    </div>
  );
};

const RuralWageLegend: React.FC<DefaultLegendContentProps> = ({ payload }) => {
  if (!payload) return null;
  return (
    <div className="rural-wage-legend">
      {payload.map((entry) => (
        <span className="rural-wage-legend-item" key={String(entry.dataKey)}>
          <span className="rural-wage-legend-dot" style={{ background: entry.color }} />
          {entry.value}
        </span>
      ))}
    </div>
  );
};

export default RuralWageRatesChart;
