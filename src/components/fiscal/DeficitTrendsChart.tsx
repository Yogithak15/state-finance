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
import { fetchFiscalFinancialYearSeries, FISCAL_METRICS } from '../../api/fiscalApi';
import { formatInrShort } from '../../utils/format';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
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
  const [selected, setSelected] = useState<string[]>([]);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const hasSetDefaultRef = useRef(false);

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

  const allStates = useMemo(
    () => Array.from(new Set(rows.map((r) => r.dimension_name))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  const filteredStates = useMemo(
    () => allStates.filter((name) => name.toLowerCase().includes(search.trim().toLowerCase())),
    [allStates, search]
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

      <div className="deficit-trends-control-group">
        <span className="deficit-trends-control-label">Measure</span>
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
      </div>

      <div className="deficit-trends-control-group">
        <div className="deficit-trends-control-header">
          <span className="deficit-trends-control-label">Search States</span>
          {selected.length > 0 && (
            <button type="button" className="deficit-trends-clear-all-link" onClick={clearAll}>
              clear all
            </button>
          )}
        </div>
        <input
          type="text"
          className="deficit-trends-state-search-input"
          placeholder="Type to filter…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="deficit-trends-state-pill-grid">
          {filteredStates.map((name) => {
            const isSelected = selected.includes(name);
            return (
              <button
                key={name}
                type="button"
                className={`deficit-trends-state-pill${isSelected ? ' selected' : ''}`}
                style={isSelected ? { background: colorMap[name], borderColor: colorMap[name] } : undefined}
                onClick={() => toggleState(name)}
              >
                {name}
              </button>
            );
          })}
          {!loading && filteredStates.length === 0 && (
            <span className="deficit-trends-state-pill-empty">No states match “{search}”.</span>
          )}
        </div>
      </div>

      {error && <div className="deficit-trends-error">{error}</div>}

      {!error && selected.length === 0 && (
        <div className="deficit-trends-empty">
          {loading ? 'Loading states…' : 'Select one or more states above to see their deficit trend.'}
        </div>
      )}

      {!error && selected.length > 0 && (
        <div className="deficit-trends-chart">
          <ResponsiveContainer width="100%" height={380}>
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
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => formatInrShort(v)}
                width={92}
              />
              <Tooltip content={(props) => <DeficitTrendsTooltip {...props} />} />
              <Legend content={(props) => <DeficitTrendsLegend {...props} />} />
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

const DeficitTrendsLegend: React.FC<DefaultLegendContentProps> = ({ payload }) => {
  if (!payload) return null;
  return (
    <div className="deficit-trends-legend">
      {payload.map((entry) => (
        <span className="deficit-trends-legend-item" key={String(entry.dataKey)}>
          <span className="deficit-trends-legend-dot" style={{ background: entry.color }} />
          {entry.value}
        </span>
      ))}
    </div>
  );
};

export default DeficitTrendsChart;
