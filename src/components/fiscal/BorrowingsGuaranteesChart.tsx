import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
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
import './BorrowingsGuaranteesChart.css';

interface MetricRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

type ViewMode = 'market-borrowings' | 'outstanding-guarantees';
type ShowMode = 'top15' | 'all';

const BorrowingsGuaranteesChart: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const [view, setView] = useState<ViewMode>('market-borrowings');

  // ── 6a · Market borrowings ────────────────────────────────────────────
  const [year, setYear] = useState<string>('');
  const [show, setShow] = useState<ShowMode>('top15');
  const [marketRows, setMarketRows] = useState<MetricRow[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMarketLoading(true);
    setMarketError(null);
    fetchFiscalFinancialYearSeries(FISCAL_METRICS.marketBorrowings)
      .then((data: MetricRow[]) => {
        if (cancelled) return;
        setMarketRows(data);
        const years = Array.from(new Set(data.map((r) => r.period))).sort();
        setYear((prev) => (prev && years.includes(prev) ? prev : years[years.length - 1] ?? ''));
        setMarketLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setMarketError('Unable to load market borrowings data.');
        setMarketLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const availableYears = useMemo(
    () => Array.from(new Set(marketRows.map((r) => r.period))).sort().reverse(),
    [marketRows]
  );

  const yearRows = useMemo(
    () => marketRows.filter((r) => r.period === year).sort((a, b) => b.value - a.value),
    [marketRows, year]
  );

  const displayRows = useMemo(() => (show === 'top15' ? yearRows.slice(0, 15) : yearRows), [yearRows, show]);

  // ── 6b · Outstanding guarantees ───────────────────────────────────────
  const [selectedState, setSelectedState] = useState('');
  const [guaranteeRows, setGuaranteeRows] = useState<MetricRow[]>([]);
  const [guaranteeLoading, setGuaranteeLoading] = useState(true);
  const [guaranteeError, setGuaranteeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setGuaranteeLoading(true);
    setGuaranteeError(null);
    fetchFiscalFinancialYearSeries(FISCAL_METRICS.outstandingGuarantees)
      .then((data: MetricRow[]) => {
        if (cancelled) return;
        setGuaranteeRows(data);
        const names = Array.from(new Set(data.map((r) => r.dimension_name))).sort((a, b) => a.localeCompare(b));
        setSelectedState((prev) => (prev && names.includes(prev) ? prev : names[0] ?? ''));
        setGuaranteeLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setGuaranteeError('Unable to load outstanding guarantees data.');
        setGuaranteeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const guaranteeStates = useMemo(
    () => Array.from(new Set(guaranteeRows.map((r) => r.dimension_name))).sort((a, b) => a.localeCompare(b)),
    [guaranteeRows]
  );

  const guaranteeChartData = useMemo(
    () =>
      guaranteeRows
        .filter((r) => r.dimension_name === selectedState)
        .map((r) => ({ period: r.period, value: r.value }))
        .sort((a, b) => a.period.localeCompare(b.period)),
    [guaranteeRows, selectedState]
  );

  return (
    <div className="borrowings-guarantees">
      <h3 className="borrowings-guarantees-title">6 · Borrowings &amp; Guarantees</h3>
      <p className="borrowings-guarantees-desc">
        Two ways a state can be on the hook for money beyond its own budget: fresh debt it raises directly, and
        contingent guarantees it extends on behalf of others.
      </p>

      <div className="borrowings-guarantees-view-toggle" role="radiogroup">
        {(['market-borrowings', 'outstanding-guarantees'] as ViewMode[]).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={view === v}
            className={`borrowings-guarantees-view-option${view === v ? ' active' : ''}`}
            onClick={() => setView(v)}
          >
            <span className="borrowings-guarantees-view-dot" />
            {v === 'market-borrowings' ? '6a · Market Borrowings' : '6b · Outstanding Guarantees'}
          </button>
        ))}
      </div>

      {view === 'market-borrowings' && (
        <>
          <p className="borrowings-guarantees-subdesc">
            How much each state raised in the bond market that year through State Development Loans.
          </p>

          <div className="borrowings-guarantees-controls">
            <div className="borrowings-guarantees-control">
              <span className="borrowings-guarantees-control-label">Year</span>
              <select
                className="borrowings-guarantees-control-select"
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

            <div className="borrowings-guarantees-control">
              <span className="borrowings-guarantees-control-label">Show</span>
              <div className="borrowings-guarantees-show-toggle" role="radiogroup">
                {([
                  { id: 'top15', label: 'Top 15' },
                  { id: 'all', label: `All (${yearRows.length})` },
                ] as { id: ShowMode; label: string }[]).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={show === opt.id}
                    className={`borrowings-guarantees-show-option${show === opt.id ? ' active' : ''}`}
                    onClick={() => setShow(opt.id)}
                  >
                    <span className="borrowings-guarantees-show-dot" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {marketError && <div className="borrowings-guarantees-error">{marketError}</div>}

          {!marketError && (marketLoading || displayRows.length === 0) && (
            <div className="borrowings-guarantees-empty">
              {marketLoading ? 'Loading market borrowings…' : 'No data for this year.'}
            </div>
          )}

          {!marketError && !marketLoading && displayRows.length > 0 && (
            <>
              <div
                className="borrowings-guarantees-chart"
                style={{ height: Math.max(displayRows.length * 32, 120) }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={displayRows}
                    layout="vertical"
                    margin={{ top: 4, right: 70, left: 8, bottom: 4 }}
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
                      dataKey="dimension_name"
                      tick={{ fontSize: 12.5, fill: colors.ink }}
                      axisLine={{ stroke: colors.grid }}
                      tickLine={false}
                      width={110}
                    />
                    <Tooltip cursor={false} content={(props) => <MarketBorrowingsTooltip {...props} />} />
                    <Bar
                      dataKey="value"
                      name="Gross amount raised"
                      fill={colors.ink}
                      radius={2}
                      maxBarSize={22}
                      activeBar={{ stroke: 'transparent' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="borrowings-guarantees-footnote">
                {show === 'top15' ? 'Top 15 states' : 'All states'} by gross amount raised, {year}. Per-state
                repayment figures aren't separately tracked in this dataset, so only gross issuance is shown.
              </div>
            </>
          )}
        </>
      )}

      {view === 'outstanding-guarantees' && (
        <>
          <p className="borrowings-guarantees-subdesc">
            Guarantees a state extends to its public-sector undertakings don't show up in the deficit, but
            they're a contingent liability — a bill that lands on the budget if the guaranteed entity defaults.
          </p>

          <div className="borrowings-guarantees-control-group">
            <span className="borrowings-guarantees-control-label">State</span>
            <select
              className="borrowings-guarantees-control-select"
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
            >
              {guaranteeStates.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {guaranteeError && <div className="borrowings-guarantees-error">{guaranteeError}</div>}

          {!guaranteeError && (guaranteeLoading || guaranteeChartData.length === 0) && (
            <div className="borrowings-guarantees-empty">
              {guaranteeLoading
                ? 'Loading outstanding guarantees…'
                : 'No outstanding guarantees data is currently available from the API for any state.'}
            </div>
          )}

          {!guaranteeError && !guaranteeLoading && guaranteeChartData.length > 0 && (
            <div className="borrowings-guarantees-chart">
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={guaranteeChartData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                  <defs>
                    <linearGradient id="guaranteesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.categorical[4]} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={colors.categorical[4]} stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
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
                    tickFormatter={(v: number) => formatInrShort(v)}
                    width={72}
                  />
                  <Tooltip content={(props) => <GuaranteesTooltip {...props} />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={colors.categorical[4]}
                    strokeWidth={2}
                    fill="url(#guaranteesFill)"
                    dot={{ r: 3, fill: colors.categorical[4], stroke: colors.surface, strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: colors.categorical[4], stroke: colors.surface, strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const MarketBorrowingsTooltip: React.FC<TooltipContentProps> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload as MetricRow | undefined;
  if (!row) return null;
  return (
    <div className="borrowings-guarantees-tooltip">
      <span className="borrowings-guarantees-tooltip-name">{row.dimension_name}</span>
      <span className="borrowings-guarantees-tooltip-value">{formatInrShort(row.value)}</span>
    </div>
  );
};

const GuaranteesTooltip: React.FC<TooltipContentProps> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="borrowings-guarantees-tooltip">
      <span className="borrowings-guarantees-tooltip-name">{label}</span>
      <span className="borrowings-guarantees-tooltip-value">{formatInrShort(Number(payload[0]?.value) || 0)}</span>
    </div>
  );
};

export default BorrowingsGuaranteesChart;
