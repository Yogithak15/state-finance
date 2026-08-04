import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  TooltipContentProps,
} from 'recharts';
import { fetchPwFinancialYearSeries, PW_METRICS } from '../../api/priceWagesApi';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import { SearchIcon } from '../icons';
import { ExpandableChart } from '../ExpandableChart';
import './InflationTrendsChart.css';

interface TrendRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

const ALL_INDIA_KEY = 'All-India';

const InflationTrendsChart: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const PALETTE = colors.categorical;
  const [rows, setRows] = useState<TrendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const [showAverage, setShowAverage] = useState(true);
  const hasSetDefaultRef = useRef(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPwFinancialYearSeries(PW_METRICS.cpiGeneral)
      .then((data: TrendRow[]) => {
        if (cancelled) return;
        setRows(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load inflation trend data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Close the add-state dropdown on an outside click.
  useEffect(() => {
    if (!pickerOpen) return undefined;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pickerOpen]);

  const allStates = useMemo(
    () => Array.from(new Set(rows.map((r) => r.dimension_name))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  const availableStates = useMemo(
    () => allStates.filter((name) => !selected.includes(name)),
    [allStates, selected]
  );

  const filteredAvailableStates = useMemo(
    () => availableStates.filter((name) => name.toLowerCase().includes(search.trim().toLowerCase())),
    [availableStates, search]
  );

  const yearRange = useMemo(() => {
    const periods = Array.from(new Set(rows.map((r) => r.period))).sort();
    return { start: periods[0] ?? '', end: periods[periods.length - 1] ?? '' };
  }, [rows]);

  // Pre-select a small, data-driven starting set (highest / median / lowest
  // inflation at the latest available year) so the chart isn't empty on
  // first load. Only runs once.
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

    // All-India average uses every reporting state for that year, not just
    // whichever ones happen to be selected — it's a national reference line.
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

  const addState = (name: string) => {
    toggleState(name);
    setSearch('');
  };

  const clearAll = () => {
    setSelected([]);
    setColorMap({});
  };

  return (
    <div className="inflation-trends">
      <h3 className="inflation-trends-title">1 · Inflation Trends over Time</h3>
      <p className="inflation-trends-desc">
        Consumer Price Index (General) inflation by state, {yearRange.start} to {yearRange.end}. Pick
        states to compare against each other and against the All-India average.
      </p>

      <div className="inflation-trends-controls">
        <button
          type="button"
          className={`inflation-average-toggle${showAverage ? ' active' : ''}`}
          aria-pressed={showAverage}
          onClick={() => setShowAverage((v) => !v)}
        >
          All-India average
        </button>

        <div className="inflation-trends-state-picker" ref={pickerRef}>
          <div className="inflation-trends-state-input-wrap">
            <SearchIcon width={14} height={14} className="inflation-trends-search-icon" />
            <input
              type="text"
              className="inflation-trends-state-input"
              placeholder="Add a state to compare…"
              value={search}
              onFocus={() => setPickerOpen(true)}
              onChange={(e) => {
                setSearch(e.target.value);
                setPickerOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredAvailableStates.length > 0) {
                  e.preventDefault();
                  addState(filteredAvailableStates[0]);
                }
              }}
            />
          </div>
          {pickerOpen && (
            <div className="inflation-trends-state-dropdown">
              {filteredAvailableStates.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="inflation-trends-state-option"
                  onClick={() => addState(name)}
                >
                  {name}
                </button>
              ))}
              {filteredAvailableStates.length === 0 && (
                <span className="inflation-trends-state-dropdown-empty">
                  {availableStates.length === 0 ? 'All states added.' : `No states match “${search}”.`}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="inflation-trends-chips-row">
          {selected.map((name) => (
            <span key={name} className="inflation-trends-chip" style={{ background: colorMap[name] }}>
              {name}
              <button
                type="button"
                className="inflation-trends-chip-remove"
                onClick={() => toggleState(name)}
                aria-label={`Remove ${name}`}
              >
                ×
              </button>
            </span>
          ))}
          <button type="button" className="inflation-clear-all-link" onClick={clearAll}>
            clear all
          </button>
        </div>
      )}

      {error && <div className="inflation-trends-error">{error}</div>}

      {!error && selected.length === 0 && !showAverage && (
        <div className="inflation-trends-empty">
          {loading ? 'Loading states…' : 'Add a state above, or turn on the All-India average, to see a trend.'}
        </div>
      )}

      {!error && (selected.length > 0 || showAverage) && (
        <ExpandableChart title="1 · Inflation Trends over Time" height={380} className="inflation-trends-chart">
          {(h) => (
          <ResponsiveContainer width="100%" height={h}>
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
                axisLine={{ stroke: colors.grid }}
                tickLine={false}
                tickFormatter={(v: number) => `${Math.round(v)}%`}
                width={36}
              />
              <Tooltip
                content={(props) => <InflationTrendsTooltip {...props} />}
                cursor={{ stroke: colors.axisText, strokeDasharray: '3 3' }}
              />
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
      )}
    </div>
  );
};

// Left-aligned so every value starts flush at the card's left edge instead of
// recharts' default right-aligned ticks, which ragged-left differently-lengthed values.
const LeftAlignedYAxisTick: React.FC<{ y?: number | string; payload?: { value: number }; fill: string }> = ({
  y,
  payload,
  fill,
}) => (
  <text x={4} y={y} dy={4} fontSize={11} fill={fill} textAnchor="start">
    {Math.round(payload?.value ?? 0)}%
  </text>
);

// Value leads (bold), state name follows, keyed by a short line — not a colored box.
const InflationTrendsTooltip: React.FC<TooltipContentProps> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const sorted = [...payload].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  return (
    <div className="inflation-trends-tooltip">
      <div className="inflation-trends-tooltip-period">{label}</div>
      {sorted.map((entry) => (
        <div className="inflation-trends-tooltip-row" key={String(entry.dataKey)}>
          <span className="inflation-trends-tooltip-key" style={{ background: entry.color }} />
          <span className="inflation-trends-tooltip-value">{Number(entry.value).toFixed(1)}%</span>
          <span className="inflation-trends-tooltip-name">{String(entry.dataKey)}</span>
        </div>
      ))}
    </div>
  );
};

export default InflationTrendsChart;
