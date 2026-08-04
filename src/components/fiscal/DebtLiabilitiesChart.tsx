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
import { SearchIcon } from '../icons';
import { ExpandableChart } from '../ExpandableChart';
import './DebtLiabilitiesChart.css';

interface MetricRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

type ViewMode = 'composition' | 'debt-gsdp';
type ShowMode = 'top15' | 'all';

// Six grouped categories built from Table 176's 17 leaf sub-components of
// outstanding liabilities — granular enough to be informative, coarse enough
// to stay readable as a stacked bar. "Other" is a residual (WMA from RBI,
// deposits & advances, contingency funds, and any unreported difference).
const CATEGORY_KEYS = [
  'Market Borrowings (SDL)',
  'Special Securities',
  'Loans from Centre',
  'Loans from Banks & FIs',
  'Small Savings & Funds',
  'Other',
] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

const SUB_METRICS = {
  sdl: FISCAL_METRICS.liabilitiesSdl,
  powerBonds: FISCAL_METRICS.liabilitiesPowerBonds,
  compBonds: FISCAL_METRICS.liabilitiesCompensationAndOtherBonds,
  centreLoans: FISCAL_METRICS.liabilitiesLoansAndAdvancesFromCentre,
  bankLoans: FISCAL_METRICS.liabilitiesLoansFromBanksAndFinancialInstitutions,
  nssf: FISCAL_METRICS.liabilitiesNssf,
  providentFund: FISCAL_METRICS.liabilitiesProvidentFund,
  reserveFunds: FISCAL_METRICS.liabilitiesReserveFunds,
} as const;
type SubMetricKey = keyof typeof SUB_METRICS;

type CompositionRow = Record<CategoryKey, number> & {
  dimensionId: number;
  state: string;
  total: number;
};

// N.K. Singh FRBM Review Committee (2017) recommended a general-government
// debt path with states carrying roughly this share of GSDP by 2024-25 — a
// real, citable ceiling, not a value we invented.
const DEBT_GSDP_SUGGESTED_CEILING = 20;

const pct = (v: number) => `${v.toFixed(1)}%`;

const DebtLiabilitiesChart: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const PALETTE = colors.categorical;
  const categoryColors: Record<CategoryKey, string> = {
    'Market Borrowings (SDL)': colors.categorical[0],
    'Special Securities': colors.categorical[1],
    'Loans from Centre': colors.categorical[2],
    'Loans from Banks & FIs': colors.categorical[3],
    'Small Savings & Funds': colors.categorical[4],
    Other: colors.muted,
  };
  const [view, setView] = useState<ViewMode>('composition');

  // ── Composition view state ────────────────────────────────────────────
  const [year, setYear] = useState<string>('');
  const [show, setShow] = useState<ShowMode>('top15');
  const [liabilitiesRows, setLiabilitiesRows] = useState<MetricRow[]>([]);
  const [subRows, setSubRows] = useState<Record<SubMetricKey, MetricRow[]>>({} as Record<SubMetricKey, MetricRow[]>);
  const [compLoading, setCompLoading] = useState(true);
  const [compError, setCompError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCompLoading(true);
    setCompError(null);
    const subKeys = Object.keys(SUB_METRICS) as SubMetricKey[];
    Promise.all([
      fetchFiscalFinancialYearSeries(FISCAL_METRICS.outstandingLiabilities),
      ...subKeys.map((k) => fetchFiscalFinancialYearSeries(SUB_METRICS[k])),
    ])
      .then(([liabilities, ...subs]: MetricRow[][]) => {
        if (cancelled) return;
        setLiabilitiesRows(liabilities);
        const nextSubRows = {} as Record<SubMetricKey, MetricRow[]>;
        subKeys.forEach((k, i) => {
          nextSubRows[k] = subs[i];
        });
        setSubRows(nextSubRows);
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
    const byStateFor = (key: SubMetricKey) => {
      const map = new Map<number, number>();
      (subRows[key] ?? [])
        .filter((r) => r.period === year)
        .forEach((r) => map.set(r.dimension_id, r.value));
      return map;
    };

    const sdlByState = byStateFor('sdl');
    const powerBondsByState = byStateFor('powerBonds');
    const compBondsByState = byStateFor('compBonds');
    const centreLoansByState = byStateFor('centreLoans');
    const bankLoansByState = byStateFor('bankLoans');
    const nssfByState = byStateFor('nssf');
    const providentFundByState = byStateFor('providentFund');
    const reserveFundsByState = byStateFor('reserveFunds');

    const rows: CompositionRow[] = liabilitiesRows
      .filter((r) => r.period === year)
      .map((r) => {
        const id = r.dimension_id;
        const marketBorrowings = sdlByState.get(id) ?? 0;
        const specialSecurities = (powerBondsByState.get(id) ?? 0) + (compBondsByState.get(id) ?? 0);
        const loansFromCentre = centreLoansByState.get(id) ?? 0;
        const loansFromBanks = bankLoansByState.get(id) ?? 0;
        const smallSavingsAndFunds =
          (nssfByState.get(id) ?? 0) + (providentFundByState.get(id) ?? 0) + (reserveFundsByState.get(id) ?? 0);
        const known = marketBorrowings + specialSecurities + loansFromCentre + loansFromBanks + smallSavingsAndFunds;
        const other = Math.max(r.value - known, 0);

        return {
          dimensionId: id,
          state: r.dimension_name,
          total: r.value,
          'Market Borrowings (SDL)': marketBorrowings,
          'Special Securities': specialSecurities,
          'Loans from Centre': loansFromCentre,
          'Loans from Banks & FIs': loansFromBanks,
          'Small Savings & Funds': smallSavingsAndFunds,
          Other: other,
        };
      });

    return rows.sort((a, b) => b.total - a.total);
  }, [liabilitiesRows, subRows, year]);

  const displayRows = useMemo(
    () => (show === 'top15' ? compositionRows.slice(0, 15) : compositionRows),
    [compositionRows, show]
  );

  // ── Debt ÷ GSDP view state ─────────────────────────────────────────────
  const [gsdpRows, setGsdpRows] = useState<MetricRow[]>([]);
  const [ratioLoading, setRatioLoading] = useState(true);
  const [ratioError, setRatioError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const hasSetDefaultRef = useRef(false);
  const pickerRef = useRef<HTMLDivElement>(null);

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

  const availableStates = useMemo(
    () => allStates.filter((name) => !selected.includes(name)),
    [allStates, selected]
  );

  const filteredAvailableStates = useMemo(
    () => availableStates.filter((name) => name.toLowerCase().includes(search.trim().toLowerCase())),
    [availableStates, search]
  );

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

  const addState = (name: string) => {
    toggleState(name);
    setSearch('');
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
            Total outstanding liabilities by state, split into market borrowings (SDLs), special securities
            (power &amp; other compensation bonds), loans from the Centre, loans from banks &amp; financial
            institutions, small-savings &amp; fund liabilities, and other residual liabilities.
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
              <ExpandableChart
                title="5 · Debt & Liabilities — Composition by state"
                height={Math.max(displayRows.length * 32, 120)}
                className="debt-liabilities-chart"
              >
                {(h) => (
                  <ResponsiveContainer width="100%" height={h}>
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
                        axisLine={{ stroke: colors.grid }}
                        tickLine={false}
                        width={110}
                      />
                      <Tooltip cursor={false} content={(props) => <CompositionTooltip {...props} />} />
                      <Legend content={(props) => <CompositionLegend {...props} />} />
                      {CATEGORY_KEYS.map((key) => (
                        <Bar
                          key={key}
                          dataKey={key}
                          stackId="debt"
                          fill={categoryColors[key]}
                          activeBar={{ stroke: 'transparent' }}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ExpandableChart>
              <div className="debt-liabilities-footnote">
                {year} · sorted by total outstanding liabilities, largest first. {displayRows.length} of{' '}
                {compositionRows.length} states/UTs with data shown. "Other" captures Ways &amp; Means Advances
                from RBI, deposits &amp; advances, and contingency fund liabilities not broken out above.
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

          <div className="debt-liabilities-state-picker" ref={pickerRef}>
            <div className="debt-liabilities-state-input-wrap">
              <SearchIcon width={14} height={14} className="debt-liabilities-search-icon" />
              <input
                type="text"
                className="debt-liabilities-state-input"
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
              <div className="debt-liabilities-state-dropdown">
                {filteredAvailableStates.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="debt-liabilities-state-option"
                    onClick={() => addState(name)}
                  >
                    {name}
                  </button>
                ))}
                {filteredAvailableStates.length === 0 && (
                  <span className="debt-liabilities-state-dropdown-empty">
                    {availableStates.length === 0 ? 'All states added.' : `No states match “${search}”.`}
                  </span>
                )}
              </div>
            )}
          </div>

          {selected.length > 0 && (
            <div className="debt-liabilities-chips-row">
              {selected.map((name) => (
                <span key={name} className="debt-liabilities-chip" style={{ background: colorMap[name] }}>
                  {name}
                  <button
                    type="button"
                    className="debt-liabilities-chip-remove"
                    onClick={() => toggleState(name)}
                    aria-label={`Remove ${name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <button type="button" className="debt-liabilities-clear-all-link" onClick={clearAll}>
                clear all
              </button>
            </div>
          )}

          {ratioError && <div className="debt-liabilities-error">{ratioError}</div>}

          {!ratioError && selected.length === 0 && (
            <div className="debt-liabilities-empty">
              {ratioLoading ? 'Loading states…' : 'Add a state above to see its debt ÷ GSDP trend.'}
            </div>
          )}

          {!ratioError && selected.length > 0 && (
            <>
              <ExpandableChart
                title="5 · Debt & Liabilities — Debt ÷ GSDP"
                height={380}
                className="debt-liabilities-chart"
              >
                {(h) => (
                  <ResponsiveContainer width="100%" height={h}>
                    <LineChart data={ratioChartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
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
                        content={(props) => <RatioTooltip {...props} />}
                        cursor={{ stroke: colors.axisText, strokeDasharray: '3 3' }}
                      />
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
                )}
              </ExpandableChart>
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
  const segments = CATEGORY_KEYS;
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

export default DebtLiabilitiesChart;
