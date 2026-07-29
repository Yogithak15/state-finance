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
  ReferenceLine,
  TooltipContentProps,
  DefaultLegendContentProps,
} from 'recharts';
import { fetchBankingFinancialYearSeries, BANKING_METRICS } from '../../api/bankingApi';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
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
  const [selected, setSelected] = useState<string[]>([]);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const hasSetDefaultRef = useRef(false);

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

  const allStates = useMemo(
    () => Array.from(new Set(rows.map((r) => r.dimension_name))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  const filteredStates = useMemo(
    () => allStates.filter((name) => name.toLowerCase().includes(search.trim().toLowerCase())),
    [allStates, search]
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

      <div className="credit-deposit-ratio-control-group">
        <span className="credit-deposit-ratio-control-label">Basis</span>
        <div className="credit-deposit-basis-toggle" role="radiogroup">
          {(['sanction', 'utilisation'] as Basis[]).map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={basis === b}
              className={`credit-deposit-basis-option${basis === b ? ' active' : ''}`}
              onClick={() => setBasis(b)}
            >
              <span className="credit-deposit-basis-dot" />
              {b === 'sanction' ? 'By sanction' : 'By utilisation'}
            </button>
          ))}
        </div>
      </div>

      <div className="credit-deposit-ratio-control-group">
        <div className="credit-deposit-ratio-control-header">
          <span className="credit-deposit-ratio-control-label">Search States</span>
          {selected.length > 0 && (
            <button type="button" className="credit-deposit-clear-all-link" onClick={clearAll}>
              clear all
            </button>
          )}
        </div>
        <input
          type="text"
          className="credit-deposit-state-search-input"
          placeholder="Type to filter…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="credit-deposit-state-pill-grid">
          {filteredStates.map((name) => {
            const isSelected = selected.includes(name);
            return (
              <button
                key={name}
                type="button"
                className={`credit-deposit-state-pill${isSelected ? ' selected' : ''}`}
                style={isSelected ? { background: colorMap[name], borderColor: colorMap[name] } : undefined}
                onClick={() => toggleState(name)}
              >
                {name}
              </button>
            );
          })}
          {!loading && filteredStates.length === 0 && (
            <span className="credit-deposit-state-pill-empty">No states match “{search}”.</span>
          )}
        </div>
      </div>

      {error && <div className="credit-deposit-ratio-error">{error}</div>}

      {!error && selected.length === 0 && (
        <div className="credit-deposit-ratio-empty">
          {loading ? 'Loading states…' : 'Select one or more states above to see their ratio trend.'}
        </div>
      )}

      {!error && selected.length > 0 && (
        <>
          <div className="credit-deposit-ratio-chart">
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
                  axisLine={{ stroke: colors.grid }}
                  tickLine={false}
                  tickFormatter={(v: number) => pct(v)}
                  width={48}
                />
                <Tooltip content={(props) => <CreditDepositTooltip {...props} />} />
                <Legend content={(props) => <CreditDepositLegend {...props} />} />
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
          </div>
          <div className="credit-deposit-ratio-footnote">
            Dashed line marks 100% — above it, a state's banks lent out more than they collect in local
            deposits; below it, deposits exceed local lending.
          </div>
        </>
      )}
    </div>
  );
};

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

const CreditDepositLegend: React.FC<DefaultLegendContentProps> = ({ payload }) => {
  if (!payload) return null;
  return (
    <div className="credit-deposit-ratio-legend">
      {payload
        .filter((entry) => typeof entry.dataKey === 'string')
        .map((entry) => (
          <span className="credit-deposit-ratio-legend-item" key={String(entry.dataKey)}>
            <span className="credit-deposit-ratio-legend-dot" style={{ background: entry.color }} />
            {entry.value}
          </span>
        ))}
    </div>
  );
};

export default CreditDepositRatioChart;
