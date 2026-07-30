import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
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
import { ExpandableChart } from '../ExpandableChart';
import './CreditMixChart.css';

interface MetricRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

const AG_KEY = 'Agriculture';
const IND_KEY = 'Industry';
const PL_KEY = 'Personal Loans';
const OTHER_KEY = 'Other (trade, services, etc.)';

type ShowMode = 'top15' | 'all';

interface MixRow {
  dimensionId: number;
  state: string;
  total: number;
  [AG_KEY]: number;
  [IND_KEY]: number;
  [PL_KEY]: number;
  [OTHER_KEY]: number;
}

const CreditMixChart: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const AG_COLOR = colors.categorical[3];
  const IND_COLOR = colors.categorical[0];
  const PL_COLOR = colors.categorical[2];
  const OTHER_COLOR = colors.muted;

  const [year, setYear] = useState<string>('');
  const [show, setShow] = useState<ShowMode>('top15');
  const [creditRows, setCreditRows] = useState<MetricRow[]>([]);
  const [agRows, setAgRows] = useState<MetricRow[]>([]);
  const [indRows, setIndRows] = useState<MetricRow[]>([]);
  const [plRows, setPlRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchBankingFinancialYearSeries(BANKING_METRICS.scbCredit),
      fetchBankingFinancialYearSeries(BANKING_METRICS.scbCreditAgriculture),
      fetchBankingFinancialYearSeries(BANKING_METRICS.scbCreditIndustry),
      fetchBankingFinancialYearSeries(BANKING_METRICS.scbPersonalLoans),
    ])
      .then(([credit, ag, ind, pl]: [MetricRow[], MetricRow[], MetricRow[], MetricRow[]]) => {
        if (cancelled) return;
        setCreditRows(credit);
        setAgRows(ag);
        setIndRows(ind);
        setPlRows(pl);
        const years = Array.from(new Set(credit.map((r) => r.period))).sort();
        setYear((prev) => (prev && years.includes(prev) ? prev : years[years.length - 1] ?? ''));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load credit mix data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const availableYears = useMemo(
    () => Array.from(new Set(creditRows.map((r) => r.period))).sort().reverse(),
    [creditRows]
  );

  const mixRows = useMemo(() => {
    const totalByState = new Map<number, MetricRow>();
    creditRows.filter((r) => r.period === year).forEach((r) => totalByState.set(r.dimension_id, r));
    const agByState = new Map<number, number>();
    agRows.filter((r) => r.period === year).forEach((r) => agByState.set(r.dimension_id, r.value));
    const indByState = new Map<number, number>();
    indRows.filter((r) => r.period === year).forEach((r) => indByState.set(r.dimension_id, r.value));
    const plByState = new Map<number, number>();
    plRows.filter((r) => r.period === year).forEach((r) => plByState.set(r.dimension_id, r.value));

    const rows: MixRow[] = [];
    totalByState.forEach((totalRow, id) => {
      const total = totalRow.value;
      if (total <= 0) return;
      const ag = agByState.get(id) ?? 0;
      const ind = indByState.get(id) ?? 0;
      const pl = plByState.get(id) ?? 0;
      const other = Math.max(total - ag - ind - pl, 0);
      rows.push({
        dimensionId: id,
        state: totalRow.dimension_name,
        total,
        [AG_KEY]: ag,
        [IND_KEY]: ind,
        [PL_KEY]: pl,
        [OTHER_KEY]: other,
      });
    });

    return rows.sort((a, b) => b.total - a.total);
  }, [creditRows, agRows, indRows, plRows, year]);

  const displayRows = useMemo(() => (show === 'top15' ? mixRows.slice(0, 15) : mixRows), [mixRows, show]);

  return (
    <div className="credit-mix">
      <h3 className="credit-mix-title">4 · Credit Mix</h3>
      <p className="credit-mix-desc">
        Agriculture, industry and personal loans as a share of total bank credit, by state. The remainder
        — trade, services, and everything else — is grouped as "Other".
      </p>

      <div className="credit-mix-controls">
        <div className="credit-mix-control">
          <span className="credit-mix-control-label">Year</span>
          <select className="credit-mix-control-select" value={year} onChange={(e) => setYear(e.target.value)}>
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="credit-mix-control">
          <span className="credit-mix-control-label">Show</span>
          <div className="credit-mix-show-toggle" role="radiogroup">
            {([
              { id: 'top15', label: 'Top 15' },
              { id: 'all', label: `All (${mixRows.length})` },
            ] as { id: ShowMode; label: string }[]).map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={show === opt.id}
                className={`credit-mix-show-option${show === opt.id ? ' active' : ''}`}
                onClick={() => setShow(opt.id)}
              >
                <span className="credit-mix-show-dot" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="credit-mix-error">{error}</div>}

      {!error && (loading || displayRows.length === 0) && (
        <div className="credit-mix-empty">
          {loading ? 'Loading credit mix…' : 'No data for this year.'}
        </div>
      )}

      {!error && !loading && displayRows.length > 0 && (
        <>
          <ExpandableChart
            title="4 · Credit Mix"
            height={Math.max(displayRows.length * 32, 120)}
            className="credit-mix-chart"
          >
            {(h) => (
              <ResponsiveContainer width="100%" height={h}>
                <BarChart
                  data={displayRows}
                  layout="vertical"
                  stackOffset="expand"
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  barCategoryGap={6}
                >
                  <CartesianGrid stroke={colors.grid} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12, fill: colors.axisText }}
                    axisLine={{ stroke: colors.grid }}
                    tickLine={false}
                    tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="state"
                    tick={{ fontSize: 12.5, fill: colors.ink }}
                    axisLine={{ stroke: colors.grid }}
                    tickLine={false}
                    width={110}
                  />
                  <Tooltip cursor={false} content={(props) => <CreditMixTooltip {...props} />} />
                  <Legend content={(props) => <CreditMixLegend {...props} />} />
                  <Bar dataKey={AG_KEY} stackId="mix" fill={AG_COLOR} activeBar={{ stroke: 'transparent' }} />
                  <Bar dataKey={IND_KEY} stackId="mix" fill={IND_COLOR} activeBar={{ stroke: 'transparent' }} />
                  <Bar dataKey={PL_KEY} stackId="mix" fill={PL_COLOR} activeBar={{ stroke: 'transparent' }} />
                  <Bar dataKey={OTHER_KEY} stackId="mix" fill={OTHER_COLOR} activeBar={{ stroke: 'transparent' }} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ExpandableChart>
          <div className="credit-mix-footnote">Sorted by total SCB credit outstanding, largest first.</div>
        </>
      )}
    </div>
  );
};

const CreditMixTooltip: React.FC<TooltipContentProps> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload as MixRow | undefined;
  if (!row) return null;
  const segments = [AG_KEY, IND_KEY, PL_KEY, OTHER_KEY] as const;
  return (
    <div className="credit-mix-tooltip">
      <div className="credit-mix-tooltip-period">{row.state}</div>
      <div className="credit-mix-tooltip-total">Total credit: {formatInrShort(row.total)}</div>
      {segments.map((key) => {
        const entry = payload.find((p) => p.dataKey === key);
        const value = row[key];
        const pct = row.total > 0 ? (value / row.total) * 100 : 0;
        return (
          <div className="credit-mix-tooltip-row" key={key}>
            <span className="credit-mix-tooltip-key" style={{ background: entry?.color }} />
            <span className="credit-mix-tooltip-value">{pct.toFixed(1)}%</span>
            <span className="credit-mix-tooltip-name">{key}</span>
          </div>
        );
      })}
    </div>
  );
};

const CreditMixLegend: React.FC<DefaultLegendContentProps> = ({ payload }) => {
  if (!payload) return null;
  return (
    <div className="credit-mix-legend">
      {payload.map((entry) => (
        <span className="credit-mix-legend-item" key={String(entry.dataKey)}>
          <span className="credit-mix-legend-dot" style={{ background: entry.color }} />
          {entry.value}
        </span>
      ))}
    </div>
  );
};

export default CreditMixChart;
