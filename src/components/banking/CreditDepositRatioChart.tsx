import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  TooltipContentProps,
} from 'recharts';
import { fetchBankingFinancialYearSeries, BANKING_METRICS } from '../../api/bankingApi';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import { SearchIcon } from '../icons';
import { ExpandableChart } from '../ExpandableChart';
import './CreditDepositRatioChart.css';

interface TrendRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

type Basis = 'sanction' | 'utilisation';

const BASIS_METRIC: Record<Basis, number> = {
  sanction: BANKING_METRICS.scbCdRatioSanction,
  utilisation: BANKING_METRICS.scbCdRatioUtilisation,
};

const pct = (v: number) => `${v.toFixed(0)}%`;

const CreditDepositRatioChart: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const PALETTE = colors.categorical;
  const [basis, setBasis] = useState<Basis>('sanction');
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
    fetchBankingFinancialYearSeries(BASIS_METRIC[basis])
      .then((data: TrendRow[]) => {
        if (cancelled) return;
        setRows(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load credit-deposit ratio data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [basis]);

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
  // ratio at the latest available year) so the chart isn't empty on first load.
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
    <div className="credit-deposit-ratio">
      <h3 className="credit-deposit-ratio-title">2 · Credit-Deposit Ratio</h3>
      <p className="credit-deposit-ratio-desc">
        How much of a state's deposit base its banks actually lend out locally. "By sanction" counts
        loans by where the branch that approved them sits; "by utilisation" counts them by where the
        money is actually used — the gap between the two shows states that are net importers or
        exporters of credit.
      </p>

      <div className="credit-deposit-ratio-controls">
        <div className="credit-deposit-basis-toggle" role="radiogroup" aria-label="Basis">
          {(['sanction', 'utilisation'] as Basis[]).map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={basis === b}
              className={`credit-deposit-basis-option${basis === b ? ' active' : ''}`}
              onClick={() => setBasis(b)}
            >
              {b === 'sanction' ? 'By sanction' : 'By utilisation'}
            </button>
          ))}
        </div>

        <div className="credit-deposit-state-picker" ref={pickerRef}>
          <div className="credit-deposit-state-input-wrap">
            <SearchIcon width={14} height={14} className="credit-deposit-search-icon" />
            <input
              type="text"
              className="credit-deposit-state-input"
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
            <div className="credit-deposit-state-dropdown">
              {filteredAvailableStates.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="credit-deposit-state-option"
                  onClick={() => addState(name)}
                >
                  {name}
                </button>
              ))}
              {filteredAvailableStates.length === 0 && (
                <span className="credit-deposit-state-dropdown-empty">
                  {availableStates.length === 0 ? 'All states added.' : `No states match “${search}”.`}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="credit-deposit-chips-row">
          {selected.map((name) => (
            <span key={name} className="credit-deposit-chip" style={{ background: colorMap[name] }}>
              {name}
              <button
                type="button"
                className="credit-deposit-chip-remove"
                onClick={() => toggleState(name)}
                aria-label={`Remove ${name}`}
              >
                ×
              </button>
            </span>
          ))}
          <button type="button" className="credit-deposit-clear-all-link" onClick={clearAll}>
            clear all
          </button>
        </div>
      )}

      {error && <div className="credit-deposit-ratio-error">{error}</div>}

      {!error && selected.length === 0 && (
        <div className="credit-deposit-ratio-empty">
          {loading ? 'Loading states…' : 'Add a state above to see its ratio trend.'}
        </div>
      )}

      {!error && selected.length > 0 && (
        <>
          <ExpandableChart title="2 · Credit-Deposit Ratio" height={380} className="credit-deposit-ratio-chart">
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
                    tickFormatter={(v: number) => pct(v)}
                    width={40}
                  />
                  <Tooltip
                    content={(props) => <CreditDepositTooltip {...props} />}
                    cursor={{ stroke: colors.axisText, strokeDasharray: '3 3' }}
                  />
                  <ReferenceLine y={100} stroke={colors.categorical[5]} strokeDasharray="6 4" />
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
            )}
          </ExpandableChart>
          <div className="credit-deposit-ratio-footnote">
            Dashed line marks 100% — above it, a state's banks lent out more than they collect in local
            deposits; below it, deposits exceed local lending.
          </div>
        </>
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
    {pct(payload?.value ?? 0)}
  </text>
);

const CreditDepositTooltip: React.FC<TooltipContentProps> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const sorted = [...payload].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  return (
    <div className="credit-deposit-ratio-tooltip">
      <div className="credit-deposit-ratio-tooltip-period">{label}</div>
      {sorted.map((entry) => (
        <div className="credit-deposit-ratio-tooltip-row" key={String(entry.dataKey)}>
          <span className="credit-deposit-ratio-tooltip-key" style={{ background: entry.color }} />
          <span className="credit-deposit-ratio-tooltip-value">{pct(Number(entry.value))}</span>
          <span className="credit-deposit-ratio-tooltip-name">{String(entry.dataKey)}</span>
        </div>
      ))}
    </div>
  );
};

export default CreditDepositRatioChart;
