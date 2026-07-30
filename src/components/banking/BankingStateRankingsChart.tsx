import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  TooltipContentProps,
} from 'recharts';
import { fetchBankingFinancialYearSeries, BANKING_METRICS } from '../../api/bankingApi';
import { formatInrShort } from '../../utils/format';
import { rankColor } from '../../utils/rankColor';
import { useTheme, ThemeMode } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import { ExpandableChart } from '../ExpandableChart';
import './BankingStateRankingsChart.css';

interface MetricRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

type Unit = 'currency' | 'percentage' | 'number';

const METRIC_OPTIONS: { id: number; label: string; unit: Unit }[] = [
  { id: BANKING_METRICS.scbOffices, label: 'Number of SCB Offices', unit: 'number' },
  { id: BANKING_METRICS.scbCdRatioSanction, label: 'SCB Credit-Deposit Ratio — By Sanction', unit: 'percentage' },
  { id: BANKING_METRICS.scbCdRatioUtilisation, label: 'SCB Credit-Deposit Ratio — By Utilisation', unit: 'percentage' },
  { id: BANKING_METRICS.scbDeposits, label: 'SCB Deposits', unit: 'currency' },
  { id: BANKING_METRICS.scbCredit, label: 'SCB Credit', unit: 'currency' },
  { id: BANKING_METRICS.scbCreditAgriculture, label: 'SCB Credit to Agriculture', unit: 'currency' },
  { id: BANKING_METRICS.scbCreditIndustry, label: 'SCB Credit to Industry', unit: 'currency' },
  { id: BANKING_METRICS.scbPersonalLoans, label: 'SCB Personal Loans', unit: 'currency' },
  { id: BANKING_METRICS.rrbDeposits, label: 'RRB Deposits', unit: 'currency' },
  { id: BANKING_METRICS.rrbCredit, label: 'RRB Credit', unit: 'currency' },
  { id: BANKING_METRICS.rrbCdRatio, label: 'RRB Credit-Deposit Ratio', unit: 'percentage' },
  { id: BANKING_METRICS.rrbBranches, label: 'Number of RRB Branches', unit: 'number' },
];

const formatCount = (v: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(v);

const formatByUnit = (v: number, unit: Unit) => {
  if (unit === 'currency') return formatInrShort(v);
  if (unit === 'percentage') return `${v.toFixed(1)}%`;
  return formatCount(v);
};

type ShowMode = 'top15' | 'bottom15' | 'all';

const BankingStateRankingsChart: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const [metricId, setMetricId] = useState<number>(BANKING_METRICS.scbDeposits);
  const [year, setYear] = useState<string>('');
  const [show, setShow] = useState<ShowMode>('top15');
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchBankingFinancialYearSeries(metricId)
      .then((data: MetricRow[]) => {
        if (cancelled) return;
        setRows(data);
        const years = Array.from(new Set(data.map((r) => r.period))).sort();
        setYear((prev) => (prev && years.includes(prev) ? prev : years[years.length - 1] ?? ''));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load state rankings data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [metricId]);

  const availableYears = useMemo(
    () => Array.from(new Set(rows.map((r) => r.period))).sort().reverse(),
    [rows]
  );

  const yearRows = useMemo(
    () => rows.filter((r) => r.period === year).sort((a, b) => b.value - a.value),
    [rows, year]
  );

  const displayRows = useMemo(() => {
    if (show === 'top15') return yearRows.slice(0, 15);
    if (show === 'bottom15') return [...yearRows.slice(-15)].sort((a, b) => b.value - a.value);
    return yearRows;
  }, [yearRows, show]);

  const metric = METRIC_OPTIONS.find((m) => m.id === metricId) ?? METRIC_OPTIONS[0];

  const showOptions: { id: ShowMode; label: string }[] = [
    { id: 'top15', label: 'Top 15' },
    { id: 'bottom15', label: 'Bottom 15' },
    { id: 'all', label: `All (${yearRows.length})` },
  ];

  return (
    <div className="banking-rankings">
      <h3 className="banking-rankings-title">3 · State Rankings</h3>
      <p className="banking-rankings-desc">
        Any one of twelve banking indicators, any year from {availableYears[availableYears.length - 1] ?? '—'}{' '}
        to {availableYears[0] ?? '—'}.
      </p>

      <div className="banking-rankings-controls">
        <div className="banking-rankings-control">
          <span className="banking-rankings-control-label">Metric</span>
          <select
            className="banking-rankings-control-select"
            value={metricId}
            onChange={(e) => setMetricId(Number(e.target.value))}
          >
            {METRIC_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="banking-rankings-control">
          <span className="banking-rankings-control-label">Year</span>
          <select
            className="banking-rankings-control-select"
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

        <div className="banking-rankings-control">
          <span className="banking-rankings-control-label">Show</span>
          <div className="banking-rankings-show-toggle" role="radiogroup">
            {showOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={show === opt.id}
                className={`banking-rankings-show-option${show === opt.id ? ' active' : ''}`}
                onClick={() => setShow(opt.id)}
              >
                <span className="banking-rankings-show-dot" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="banking-rankings-error">{error}</div>}

      {!error && (loading || displayRows.length === 0) && (
        <div className="banking-rankings-empty">
          {loading ? 'Loading state rankings…' : 'No data for this year/metric.'}
        </div>
      )}

      {!error && !loading && displayRows.length > 0 && (
        <>
          <ExpandableChart
            title="3 · State Rankings"
            height={Math.max(displayRows.length * 32, 120)}
            className="banking-rankings-chart"
          >
            {(h) => (
              <ResponsiveContainer width="100%" height={h}>
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
                    tickFormatter={(v: number) => formatByUnit(v, metric.unit)}
                  />
                  <YAxis
                    type="category"
                    dataKey="dimension_name"
                    tick={{ fontSize: 12.5, fill: colors.ink }}
                    axisLine={{ stroke: colors.grid }}
                    tickLine={false}
                    width={110}
                  />
                  <Tooltip
                    cursor={false}
                    content={(props) => (
                      <BankingRankingsTooltip {...props} rows={displayRows} theme={theme} unit={metric.unit} />
                    )}
                  />
                  <Bar dataKey="value" radius={2} maxBarSize={22} activeBar={{ stroke: 'transparent' }}>
                    {displayRows.map((row, index) => (
                      <Cell key={row.dimension_id} fill={rankColor(index, displayRows.length, theme)} />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="right"
                      formatter={(v: React.ReactNode) => formatByUnit(Number(v), metric.unit)}
                      style={{ fontSize: 11.5, fill: colors.axisText }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ExpandableChart>
          <div className="banking-rankings-footnote">
            {metric.label} · {year} · {displayRows.length} of {yearRows.length} states/UTs with data shown.
          </div>
        </>
      )}
    </div>
  );
};

const BankingRankingsTooltip: React.FC<
  TooltipContentProps & { rows: MetricRow[]; theme: ThemeMode; unit: Unit }
> = ({ active, payload, rows, theme, unit }) => {
  if (!active || !payload || !payload.length) return null;
  const dimensionId = payload[0]?.payload?.dimension_id as number | undefined;
  const rowIndex = rows.findIndex((r) => r.dimension_id === dimensionId);
  const row = rows[rowIndex];
  if (!row) return null;

  return (
    <div className="banking-rankings-tooltip">
      <span
        className="banking-rankings-tooltip-key"
        style={{ background: rankColor(rowIndex, rows.length, theme) }}
      />
      <span className="banking-rankings-tooltip-name">{row.dimension_name}</span>
      <span className="banking-rankings-tooltip-value">{formatByUnit(row.value, unit)}</span>
    </div>
  );
};

export default BankingStateRankingsChart;
