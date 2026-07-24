import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
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
import { fetchFiscalFinancialYearSeries, FISCAL_METRICS } from '../../api/fiscalApi';
import { fetchSdpFinancialYearSeries, SDP_METRICS } from '../../api/stateDomesticProductApi';
import { formatInrShort } from '../../utils/format';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import './DebtLiabilitiesChart.css';

interface MetricRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

type ViewMode = 'composition' | 'debt-gsdp';
type ShowMode = 'top15' | 'all';

const MARKET_KEY = 'Market Borrowings (SDLs)';
const OTHER_KEY = 'Other Liabilities';

interface CompositionRow {
  dimensionId: number;
  state: string;
  total: number;
  [MARKET_KEY]: number;
  [OTHER_KEY]: number;
}

// N.K. Singh FRBM Review Committee (2017) recommended a general-government
// debt path with states carrying roughly this share of GSDP by 2024-25 — a
// real, citable ceiling, not a value we invented.
const DEBT_GSDP_SUGGESTED_CEILING = 20;

const pct = (v: number) => `${v.toFixed(1)}%`;

const DebtLiabilitiesChart: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const PALETTE = colors.categorical;
  const [view, setView] = useState<ViewMode>('composition');

  // ── Composition view state ────────────────────────────────────────────
  const [year, setYear] = useState<string>('');
  const [show, setShow] = useState<ShowMode>('top15');
  const [liabilitiesRows, setLiabilitiesRows] = useState<MetricRow[]>([]);
  const [marketRows, setMarketRows] = useState<MetricRow[]>([]);
  const [compLoading, setCompLoading] = useState(true);
  const [compError, setCompError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCompLoading(true);
    setCompError(null);
    Promise.all([
      fetchFiscalFinancialYearSeries(FISCAL_METRICS.outstandingLiabilities),
      fetchFiscalFinancialYearSeries(FISCAL_METRICS.marketBorrowings),
    ])
      .then(([liabilities, market]: [MetricRow[], MetricRow[]]) => {
        if (cancelled) return;
        setLiabilitiesRows(liabilities);
        setMarketRows(market);
        const years = Array.from(new Set(liabilities.map((r) => r.period))).sort();
        setYear((prev) => (prev && years.includes(prev) ? prev : years[years.length - 1] ?? ''));
        setCompLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setCompError('Unable to load debt & liabilities data.');
        setCompLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const availableYears = useMemo(
    () => Array.from(new Set(liabilitiesRows.map((r) => r.period))).sort().reverse(),
    [liabilitiesRows]
  );

  const compositionRows = useMemo(() => {
    const marketByState = new Map<number, number>();
    marketRows.filter((r) => r.period === year).forEach((r) => marketByState.set(r.dimension_id, r.value));

    const rows: CompositionRow[] = liabilitiesRows
      .filter((r) => r.period === year)
      .map((r) => {
        const market = Math.min(marketByState.get(r.dimension_id) ?? 0, r.value);
        return {
          dimensionId: r.dimension_id,
          state: r.dimension_name,
          total: r.value,
          [MARKET_KEY]: market,
          [OTHER_KEY]: r.value - market,
        };
      });

    return rows.sort((a, b) => b.total - a.total);
  }, [liabilitiesRows, marketRows, year]);

  const displayRows = useMemo(
    () => (show === 'top15' ? compositionRows.slice(0, 15) : compositionRows),
    [compositionRows, show]
  );

  // ── Debt ÷ GSDP view state ─────────────────────────────────────────────
  const [gsdpRows, setGsdpRows] = useState<MetricRow[]>([]);
  const [ratioLoading, setRatioLoading] = useState(true);
  const [ratioError, setRatioError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const hasSetDefaultRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setRatioLoading(true);
    setRatioError(null);
    fetchSdpFinancialYearSeries(SDP_METRICS.gsdpCurrent)
      .then((data: MetricRow[]) => {
        if (cancelled) return;
        setGsdpRows(data);
        setRatioLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setRatioError('Unable to load debt ÷ GSDP data.');
        setRatioLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { ratioRows, yearRange } = useMemo(() => {
    const gsdpByState = new Map<number, Map<string, number>>();
    gsdpRows.forEach((r) => {
      if (!gsdpByState.has(r.dimension_id)) gsdpByState.set(r.dimension_id, new Map());
      gsdpByState.get(r.dimension_id)!.set(r.period, r.value);
    });

    const rows: MetricRow[] = [];
    liabilitiesRows.forEach((r) => {
      const gsdp = gsdpByState.get(r.dimension_id)?.get(r.period);
      if (!gsdp) return;
      rows.push({ ...r, value: (r.value / gsdp) * 100 });
    });

    const periods = Array.from(new Set(rows.map((r) => r.period))).sort();
    return { ratioRows: rows, yearRange: { start: periods[0] ?? '', end: periods[periods.length - 1] ?? '' } };
  }, [liabilitiesRows, gsdpRows]);

  const allStates = useMemo(
    () => Array.from(new Set(ratioRows.map((r) => r.dimension_name))).sort((a, b) => a.localeCompare(b)),
    [ratioRows]
  );

  const filteredStates = useMemo(
    () => allStates.filter((name) => name.toLowerCase().includes(search.trim().toLowerCase())),
    [allStates, search]
  );

  useEffect(() => {
    if (hasSetDefaultRef.current || ratioRows.length === 0) return;
    const latestPeriod = ratioRows.reduce((max, r) => (r.period > max ? r.period : max), '');
    const latestRows = ratioRows.filter((r) => r.period === latestPeriod).sort((a, b) => b.value - a.value);
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
  }, [ratioRows, PALETTE]);

  const ratioChartData = useMemo(() => {
    const byPeriod = new Map<string, Record<string, number | string>>();
    ratioRows.forEach((r) => {
      if (!selected.includes(r.dimension_name)) return;
      if (!byPeriod.has(r.period)) byPeriod.set(r.period, { period: r.period });
      (byPeriod.get(r.period) as Record<string, number | string>)[r.dimension_name] = r.value;
    });
    return Array.from(byPeriod.values()).sort((a, b) => String(a.period).localeCompare(String(b.period)));
  }, [ratioRows, selected]);

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
    <div className="debt-liabilities">
      <h3 className="debt-liabilities-title">5 · Debt &amp; Liabilities</h3>
      <p className="debt-liabilities-desc">
        How much a state owes in outright borrowings, how much more it's guaranteed on behalf of others, and
        how that debt load compares to the size of its economy.
      </p>

      <div className="debt-liabilities-view-toggle" role="radiogroup">
        {(['composition', 'debt-gsdp'] as ViewMode[]).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={view === v}
            className={`debt-liabilities-view-option${view === v ? ' active' : ''}`}
            onClick={() => setView(v)}
          >
            <span className="debt-liabilities-view-dot" />
            {v === 'composition' ? 'Composition by state' : 'Debt ÷ GSDP'}
          </button>
        ))}
      </div>

      {view === 'composition' && (
        <>
          <p className="debt-liabilities-subdesc">
            Total outstanding liabilities by state, split into market borrowings (State Development Loans raised
            from the bond market) and everything else — loans from the Centre, provident fund, reserve funds and
            other internal debt.
          </p>

          <div className="debt-liabilities-controls">
            <div className="debt-liabilities-control">
              <span className="debt-liabilities-control-label">Year (as at end-March)</span>
              <select
                className="debt-liabilities-control-select"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="debt-liabilities-control">
              <span className="debt-liabilities-control-label">Show</span>
              <div className="debt-liabilities-show-toggle" role="radiogroup">
                {([
                  { id: 'top15', label: 'Top 15' },
                  { id: 'all', label: `All (${compositionRows.length})` },
                ] as { id: ShowMode; label: string }[]).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={show === opt.id}
                    className={`debt-liabilities-show-option${show === opt.id ? ' active' : ''}`}
                    onClick={() => setShow(opt.id)}
                  >
                    <span className="debt-liabilities-show-dot" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {compError && <div className="debt-liabilities-error">{compError}</div>}

          {!compError && (compLoading || displayRows.length === 0) && (
            <div className="debt-liabilities-empty">
              {compLoading ? 'Loading debt & liabilities…' : 'No data for this year.'}
            </div>
          )}

          {!compError && !compLoading && displayRows.length > 0 && (
            <>
              <div className="debt-liabilities-chart" style={{ height: Math.max(displayRows.length * 32, 120) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={displayRows}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                    barCategoryGap={6}
                  >
                    <CartesianGrid stroke={colors.grid} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 12, fill: colors.axisText }}
                      axisLine={{ stroke: colors.grid }}
                      tickLine={false}
                      tickFormatter={(v: number) => formatInrShort(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="state"
                      tick={{ fontSize: 12.5, fill: colors.ink }}
                      axisLine={false}
                      tickLine={false}
                      width={110}
                    />
                    <Tooltip content={(props) => <CompositionTooltip {...props} />} />
                    <Legend content={(props) => <CompositionLegend {...props} />} />
                    <Bar
                      dataKey={MARKET_KEY}
                      stackId="debt"
                      fill={colors.categorical[5]}
                      activeBar={{ stroke: 'transparent' }}
                    />
                    <Bar
                      dataKey={OTHER_KEY}
                      stackId="debt"
                      fill={colors.muted}
                      activeBar={{ stroke: 'transparent' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="debt-liabilities-footnote">
                {year} · sorted by total outstanding liabilities, largest first. {displayRows.length} of{' '}
                {compositionRows.length} states/UTs with data shown. Market borrowings data is available from
                2017-18 onward; years before that show the full total as "Other Liabilities".
              </div>
            </>
          )}
        </>
      )}

      {view === 'debt-gsdp' && (
        <>
          <p className="debt-liabilities-subdesc">
            Outstanding liabilities as a share of each state's own GSDP, over time — the debt-sustainability
            ratio the N.K. Singh FRBM Review Committee benchmarked states against.
          </p>

          <div className="debt-liabilities-control-group">
            <div className="debt-liabilities-control-header">
              <span className="debt-liabilities-control-label">Search States</span>
              {selected.length > 0 && (
                <button type="button" className="debt-liabilities-clear-all-link" onClick={clearAll}>
                  clear all
                </button>
              )}
            </div>
            <input
              type="text"
              className="debt-liabilities-state-search-input"
              placeholder="Type to filter…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="debt-liabilities-state-pill-grid">
              {filteredStates.map((name) => {
                const isSelected = selected.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    className={`debt-liabilities-state-pill${isSelected ? ' selected' : ''}`}
                    style={isSelected ? { background: colorMap[name], borderColor: colorMap[name] } : undefined}
                    onClick={() => toggleState(name)}
                  >
                    {name}
                  </button>
                );
              })}
              {!ratioLoading && filteredStates.length === 0 && (
                <span className="debt-liabilities-state-pill-empty">No states match "{search}".</span>
              )}
            </div>
          </div>

          {ratioError && <div className="debt-liabilities-error">{ratioError}</div>}

          {!ratioError && selected.length === 0 && (
            <div className="debt-liabilities-empty">
              {ratioLoading ? 'Loading states…' : 'Select one or more states above to see their debt ÷ GSDP trend.'}
            </div>
          )}

          {!ratioError && selected.length > 0 && (
            <>
              <div className="debt-liabilities-chart">
                <ResponsiveContainer width="100%" height={380}>
                  <LineChart data={ratioChartData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
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
                      tickFormatter={(v: number) => pct(v)}
                      width={48}
                    />
                    <Tooltip content={(props) => <RatioTooltip {...props} />} />
                    <Legend content={(props) => <RatioLegend {...props} />} />
                    <ReferenceLine
                      y={DEBT_GSDP_SUGGESTED_CEILING}
                      stroke={colors.categorical[5]}
                      strokeDasharray="6 4"
                      label={{
                        value: `~${DEBT_GSDP_SUGGESTED_CEILING}% suggested ceiling`,
                        position: 'insideBottomLeft',
                        fill: colors.categorical[5],
                        fontSize: 11,
                      }}
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
              <div className="debt-liabilities-footnote">
                Dashed line marks the N.K. Singh FRBM Review Committee's suggested ~{DEBT_GSDP_SUGGESTED_CEILING}%-of-GSDP
                debt ceiling. Ratio computed only for {yearRange.start} to {yearRange.end}, where GSDP data is
                available.
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

const CompositionTooltip: React.FC<TooltipContentProps> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload as CompositionRow | undefined;
  if (!row) return null;
  const segments = [MARKET_KEY, OTHER_KEY] as const;
  return (
    <div className="debt-liabilities-tooltip">
      <div className="debt-liabilities-tooltip-period">{row.state}</div>
      <div className="debt-liabilities-tooltip-total">Total: {formatInrShort(row.total)}</div>
      {segments.map((key) => {
        const entry = payload.find((p) => p.dataKey === key);
        return (
          <div className="debt-liabilities-tooltip-row" key={key}>
            <span className="debt-liabilities-tooltip-key" style={{ background: entry?.color }} />
            <span className="debt-liabilities-tooltip-value">{formatInrShort(row[key])}</span>
            <span className="debt-liabilities-tooltip-name">{key}</span>
          </div>
        );
      })}
    </div>
  );
};

const CompositionLegend: React.FC<DefaultLegendContentProps> = ({ payload }) => {
  if (!payload) return null;
  return (
    <div className="debt-liabilities-legend">
      {payload.map((entry) => (
        <span className="debt-liabilities-legend-item" key={String(entry.dataKey)}>
          <span className="debt-liabilities-legend-dot" style={{ background: entry.color }} />
          {entry.value}
        </span>
      ))}
    </div>
  );
};

const RatioTooltip: React.FC<TooltipContentProps> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const sorted = [...payload].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  return (
    <div className="debt-liabilities-tooltip">
      <div className="debt-liabilities-tooltip-period">{label}</div>
      {sorted.map((entry) => (
        <div className="debt-liabilities-tooltip-row" key={String(entry.dataKey)}>
          <span className="debt-liabilities-tooltip-key" style={{ background: entry.color }} />
          <span className="debt-liabilities-tooltip-value">{pct(Number(entry.value))}</span>
          <span className="debt-liabilities-tooltip-name">{String(entry.dataKey)}</span>
        </div>
      ))}
    </div>
  );
};

const RatioLegend: React.FC<DefaultLegendContentProps> = ({ payload }) => {
  if (!payload) return null;
  return (
    <div className="debt-liabilities-legend">
      {payload
        .filter((entry) => typeof entry.dataKey === 'string')
        .map((entry) => (
          <span className="debt-liabilities-legend-item" key={String(entry.dataKey)}>
            <span className="debt-liabilities-legend-dot" style={{ background: entry.color }} />
            {entry.value}
          </span>
        ))}
    </div>
  );
};

export default DebtLiabilitiesChart;
