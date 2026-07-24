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
import { fetchBankingFinancialYearSeries, BANKING_METRICS } from '../../api/bankingApi';
import { formatInrShort } from '../../utils/format';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import './DepositsCreditTrendChart.css';

interface TrendRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

const MEASURE_OPTIONS = [
  { id: BANKING_METRICS.scbDeposits, label: 'SCB Deposits' },
  { id: BANKING_METRICS.scbCredit, label: 'SCB Credit' },
  { id: BANKING_METRICS.scbCreditAgriculture, label: 'Credit to Agriculture' },
  { id: BANKING_METRICS.scbCreditIndustry, label: 'Credit to Industry' },
  { id: BANKING_METRICS.scbPersonalLoans, label: 'Personal Loans' },
];

const DEFAULT_SELECTION_SIZE = 5;

const DepositsCreditTrendChart: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const PALETTE = colors.categorical;
  const [measureId, setMeasureId] = useState<number>(BANKING_METRICS.scbDeposits);
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
    fetchBankingFinancialYearSeries(measureId)
      .then((data: TrendRow[]) => {
        if (cancelled) return;
        setRows(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load deposits & credit trend data.');
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

  const yearRange = useMemo(() => {
    const periods = Array.from(new Set(rows.map((r) => r.period))).sort();
    return { start: periods[0] ?? '', end: periods[periods.length - 1] ?? '' };
  }, [rows]);

  // Pre-select the 5 largest states by value at the latest available year —
  // deposits/credit are heavily right-skewed, so "biggest markets" is a more
  // meaningful data-driven default here than a highest/median/lowest split.
  useEffect(() => {
    if (hasSetDefaultRef.current || rows.length === 0) return;
    const latestPeriod = rows.reduce((max, r) => (r.period > max ? r.period : max), '');
    const latestRows = rows.filter((r) => r.period === latestPeriod).sort((a, b) => b.value - a.value);
    if (latestRows.length === 0) return;

    const defaultNames = latestRows.slice(0, DEFAULT_SELECTION_SIZE).map((r) => r.dimension_name);

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
    <div className="deposits-credit-trend">
      <h3 className="deposits-credit-trend-title">1 · Deposits &amp; Credit over Time</h3>
      <p className="deposits-credit-trend-desc">
        Scheduled commercial bank deposits and lending by state, {yearRange.start} to {yearRange.end} (as
        at end-March). Switch between total deposits, total credit, and the three lending categories
        broken out below.
      </p>

      <div className="deposits-credit-trend-control-group">
        <span className="deposits-credit-trend-control-label">Measure</span>
        <select
          className="deposits-credit-measure-select"
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

      <div className="deposits-credit-trend-control-group">
        <div className="deposits-credit-trend-control-header">
          <span className="deposits-credit-trend-control-label">Search States</span>
          {selected.length > 0 && (
            <button type="button" className="deposits-credit-clear-all-link" onClick={clearAll}>
              clear all
            </button>
          )}
        </div>
        <input
          type="text"
          className="deposits-credit-state-search-input"
          placeholder="Type to filter…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="deposits-credit-state-pill-grid">
          {filteredStates.map((name) => {
            const isSelected = selected.includes(name);
            return (
              <button
                key={name}
                type="button"
                className={`deposits-credit-state-pill${isSelected ? ' selected' : ''}`}
                style={isSelected ? { background: colorMap[name], borderColor: colorMap[name] } : undefined}
                onClick={() => toggleState(name)}
              >
                {name}
              </button>
            );
          })}
          {!loading && filteredStates.length === 0 && (
            <span className="deposits-credit-state-pill-empty">No states match “{search}”.</span>
          )}
        </div>
      </div>

      {error && <div className="deposits-credit-trend-error">{error}</div>}

      {!error && selected.length === 0 && (
        <div className="deposits-credit-trend-empty">
          {loading ? 'Loading states…' : 'Select one or more states above to see their trend.'}
        </div>
      )}

      {!error && selected.length > 0 && (
        <div className="deposits-credit-trend-chart">
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
              <Tooltip content={(props) => <DepositsCreditTooltip {...props} />} />
              <Legend content={(props) => <DepositsCreditLegend {...props} />} />
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

// Value leads (bold), state name follows, keyed by a short line — not a colored box.
const DepositsCreditTooltip: React.FC<TooltipContentProps> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const sorted = [...payload].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  return (
    <div className="deposits-credit-trend-tooltip">
      <div className="deposits-credit-trend-tooltip-period">{label}</div>
      {sorted.map((entry) => (
        <div className="deposits-credit-trend-tooltip-row" key={String(entry.dataKey)}>
          <span className="deposits-credit-trend-tooltip-key" style={{ background: entry.color }} />
          <span className="deposits-credit-trend-tooltip-value">{formatInrShort(Number(entry.value))}</span>
          <span className="deposits-credit-trend-tooltip-name">{String(entry.dataKey)}</span>
        </div>
      ))}
    </div>
  );
};

// Dot + state name in text ink — identity never carried by colored text alone.
const DepositsCreditLegend: React.FC<DefaultLegendContentProps> = ({ payload }) => {
  if (!payload) return null;
  return (
    <div className="deposits-credit-trend-legend">
      {payload.map((entry) => (
        <span className="deposits-credit-trend-legend-item" key={String(entry.dataKey)}>
          <span className="deposits-credit-trend-legend-dot" style={{ background: entry.color }} />
          {entry.value}
        </span>
      ))}
    </div>
  );
};

export default DepositsCreditTrendChart;
