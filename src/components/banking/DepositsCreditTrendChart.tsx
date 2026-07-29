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
import { fetchBankingFinancialYearSeries, BANKING_METRICS } from '../../api/bankingApi';
import { formatInrShort } from '../../utils/format';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import { SearchIcon } from '../icons';
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const hasSetDefaultRef = useRef(false);
  const pickerRef = useRef<HTMLDivElement>(null);

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

  const addState = (name: string) => {
    toggleState(name);
    setSearch('');
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

      <div className="deposits-credit-trend-controls">
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

        <div className="deposits-credit-state-picker" ref={pickerRef}>
          <div className="deposits-credit-state-input-wrap">
            <SearchIcon width={14} height={14} className="deposits-credit-search-icon" />
            <input
              type="text"
              className="deposits-credit-state-input"
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
            <div className="deposits-credit-state-dropdown">
              {filteredAvailableStates.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="deposits-credit-state-option"
                  onClick={() => addState(name)}
                >
                  {name}
                </button>
              ))}
              {filteredAvailableStates.length === 0 && (
                <span className="deposits-credit-state-dropdown-empty">
                  {availableStates.length === 0 ? 'All states added.' : `No states match “${search}”.`}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="deposits-credit-chips-row">
          {selected.map((name) => (
            <span key={name} className="deposits-credit-chip" style={{ background: colorMap[name] }}>
              {name}
              <button
                type="button"
                className="deposits-credit-chip-remove"
                onClick={() => toggleState(name)}
                aria-label={`Remove ${name}`}
              >
                ×
              </button>
            </span>
          ))}
          <button type="button" className="deposits-credit-clear-all-link" onClick={clearAll}>
            clear all
          </button>
        </div>
      )}

      {error && <div className="deposits-credit-trend-error">{error}</div>}

      {!error && selected.length === 0 && (
        <div className="deposits-credit-trend-empty">
          {loading ? 'Loading states…' : 'Add a state above to see its trend.'}
        </div>
      )}

      {!error && selected.length > 0 && (
        <div className="deposits-credit-trend-chart">
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
                content={(props) => <DepositsCreditTooltip {...props} />}
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

export default DepositsCreditTrendChart;
