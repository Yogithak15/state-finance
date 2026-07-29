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
import { fetchFiscalFinancialYearSeries, FISCAL_METRICS } from '../../api/fiscalApi';
import { formatInrShort } from '../../utils/format';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import { SearchIcon } from '../icons';
import './DeficitTrendsChart.css';

interface TrendRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

const MEASURE_OPTIONS = [
  { id: FISCAL_METRICS.grossFiscalDeficit, label: 'Gross Fiscal Deficit' },
  { id: FISCAL_METRICS.revenueDeficit, label: 'Revenue Deficit' },
  { id: FISCAL_METRICS.primaryDeficit, label: 'Primary Deficit' },
];

const DeficitTrendsChart: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const PALETTE = colors.categorical;
  const [measureId, setMeasureId] = useState<number>(FISCAL_METRICS.grossFiscalDeficit);
  const [rows, setRows] = useState<TrendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const hasSetDefaultRef = useRef(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchFiscalFinancialYearSeries(measureId)
      .then((data: TrendRow[]) => {
        if (cancelled) return;
        setRows(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load deficit trend data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [measureId]);

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

  // Pre-select a small, data-driven starting set (highest / median / lowest
  // at the latest available year). Only runs once.
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
      if (!selected.includes(r.dimension_name)) return;
      if (!byPeriod.has(r.period)) byPeriod.set(r.period, { period: r.period });
      (byPeriod.get(r.period) as Record<string, number | string>)[r.dimension_name] = r.value;
    });
    return Array.from(byPeriod.values()).sort((a, b) => String(a.period).localeCompare(String(b.period)));
  }, [rows, selected]);

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
    <div className="deficit-trends">
      <h3 className="deficit-trends-title">1 · Deficit Trends over Time</h3>
      <p className="deficit-trends-desc">
        Gross fiscal deficit, revenue deficit and primary deficit are the three headline gaps in a state
        budget. A multi-line series shows who has run persistent deficits—and who has swung into surplus.
      </p>

      <div className="deficit-trends-sign-note">Sign convention: positive = deficit, negative = surplus.</div>

      <div className="deficit-trends-controls">
        <select
          className="deficit-trends-measure-select"
          value={measureId}
          onChange={(e) => setMeasureId(Number(e.target.value))}
        >
          {MEASURE_OPTIONS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>

        <div className="deficit-trends-state-picker" ref={pickerRef}>
          <div className="deficit-trends-state-input-wrap">
            <SearchIcon width={14} height={14} className="deficit-trends-search-icon" />
            <input
              type="text"
              className="deficit-trends-state-input"
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
            <div className="deficit-trends-state-dropdown">
              {filteredAvailableStates.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="deficit-trends-state-option"
                  onClick={() => addState(name)}
                >
                  {name}
                </button>
              ))}
              {filteredAvailableStates.length === 0 && (
                <span className="deficit-trends-state-dropdown-empty">
                  {availableStates.length === 0 ? 'All states added.' : `No states match “${search}”.`}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="deficit-trends-chips-row">
          {selected.map((name) => (
            <span key={name} className="deficit-trends-chip" style={{ background: colorMap[name] }}>
              {name}
              <button
                type="button"
                className="deficit-trends-chip-remove"
                onClick={() => toggleState(name)}
                aria-label={`Remove ${name}`}
              >
                ×
              </button>
            </span>
          ))}
          <button type="button" className="deficit-trends-clear-all-link" onClick={clearAll}>
            clear all
          </button>
        </div>
      )}

      {error && <div className="deficit-trends-error">{error}</div>}

      {!error && selected.length === 0 && (
        <div className="deficit-trends-empty">
          {loading ? 'Loading states…' : 'Add a state above to see its deficit trend.'}
        </div>
      )}

      {!error && selected.length > 0 && (
        <div className="deficit-trends-chart">
          <ResponsiveContainer width="100%" height={360}>
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
                tickFormatter={(v: number) => formatInrShort(v)}
                width={44}
              />
              <Tooltip
                content={(props) => <DeficitTrendsTooltip {...props} />}
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
            </LineChart>
          </ResponsiveContainer>
        </div>
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
    {formatInrShort(payload?.value ?? 0)}
  </text>
);

const DeficitTrendsTooltip: React.FC<TooltipContentProps> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const sorted = [...payload].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  return (
    <div className="deficit-trends-tooltip">
      <div className="deficit-trends-tooltip-period">{label}</div>
      {sorted.map((entry) => (
        <div className="deficit-trends-tooltip-row" key={String(entry.dataKey)}>
          <span className="deficit-trends-tooltip-key" style={{ background: entry.color }} />
          <span className="deficit-trends-tooltip-value">{formatInrShort(Number(entry.value))}</span>
          <span className="deficit-trends-tooltip-name">{String(entry.dataKey)}</span>
        </div>
      ))}
    </div>
  );
};

export default DeficitTrendsChart;
