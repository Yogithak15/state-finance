import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  TooltipContentProps,
  DefaultLegendContentProps,
} from 'recharts';
import { fetchFiscalFinancialYearSeries, FISCAL_METRICS } from '../../api/fiscalApi';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import { ExpandableChart } from '../ExpandableChart';
import './RevenueSpendingMixChart.css';

interface MetricRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

type ViewMode = 'revenue' | 'expenditure';

const OWN_TAX_KEY = 'Own tax revenue';
const OWN_NON_TAX_KEY = 'Own non-tax revenue';
const INTEREST_KEY = 'Interest payments';
const PENSION_KEY = 'Pension';
const SOCIAL_KEY = 'Social sector';
const OTHER_KEY = 'Other spending';

const pct = (v: number) => `${v.toFixed(1)}%`;

const RevenueSpendingMixChart: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const [view, setView] = useState<ViewMode>('revenue');
  const [selectedState, setSelectedState] = useState('');
  const [ownTaxRows, setOwnTaxRows] = useState<MetricRow[]>([]);
  const [ownNonTaxRows, setOwnNonTaxRows] = useState<MetricRow[]>([]);
  const [revExpRows, setRevExpRows] = useState<MetricRow[]>([]);
  const [interestRows, setInterestRows] = useState<MetricRow[]>([]);
  const [pensionRows, setPensionRows] = useState<MetricRow[]>([]);
  const [socialRows, setSocialRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchFiscalFinancialYearSeries(FISCAL_METRICS.ownTaxRevenue),
      fetchFiscalFinancialYearSeries(FISCAL_METRICS.ownNonTaxRevenue),
      fetchFiscalFinancialYearSeries(FISCAL_METRICS.revenueExpenditure),
      fetchFiscalFinancialYearSeries(FISCAL_METRICS.interestPayments),
      fetchFiscalFinancialYearSeries(FISCAL_METRICS.pensionExpenditure),
      fetchFiscalFinancialYearSeries(FISCAL_METRICS.socialSectorExpenditure),
    ])
      .then(([ownTax, ownNonTax, revExp, interest, pension, social]: MetricRow[][]) => {
        if (cancelled) return;
        setOwnTaxRows(ownTax);
        setOwnNonTaxRows(ownNonTax);
        setRevExpRows(revExp);
        setInterestRows(interest);
        setPensionRows(pension);
        setSocialRows(social);
        const names = Array.from(new Set(ownTax.map((r) => r.dimension_name))).sort((a, b) =>
          a.localeCompare(b)
        );
        setSelectedState((prev) => (prev && names.includes(prev) ? prev : names[0] ?? ''));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load revenue & spending mix data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const availableStates = useMemo(
    () => Array.from(new Set(ownTaxRows.map((r) => r.dimension_name))).sort((a, b) => a.localeCompare(b)),
    [ownTaxRows]
  );

  const { chartData, avgShare } = useMemo(() => {
    const byPeriod = new Map<string, Record<string, number | string>>();
    const shares: number[] = [];

    if (view === 'revenue') {
      const taxByPeriod = new Map(
        ownTaxRows.filter((r) => r.dimension_name === selectedState).map((r) => [r.period, r.value])
      );
      const nonTaxByPeriod = new Map(
        ownNonTaxRows.filter((r) => r.dimension_name === selectedState).map((r) => [r.period, r.value])
      );
      Array.from(taxByPeriod.keys())
        .filter((p) => nonTaxByPeriod.has(p))
        .forEach((p) => {
          const tax = taxByPeriod.get(p) as number;
          const nonTax = nonTaxByPeriod.get(p) as number;
          byPeriod.set(p, { period: p, [OWN_TAX_KEY]: tax, [OWN_NON_TAX_KEY]: nonTax });
          if (tax + nonTax > 0) shares.push((tax / (tax + nonTax)) * 100);
        });
    } else {
      const revExpByPeriod = new Map(
        revExpRows.filter((r) => r.dimension_name === selectedState).map((r) => [r.period, r.value])
      );
      const interestByPeriod = new Map(
        interestRows.filter((r) => r.dimension_name === selectedState).map((r) => [r.period, r.value])
      );
      const pensionByPeriod = new Map(
        pensionRows.filter((r) => r.dimension_name === selectedState).map((r) => [r.period, r.value])
      );
      const socialByPeriod = new Map(
        socialRows.filter((r) => r.dimension_name === selectedState).map((r) => [r.period, r.value])
      );
      revExpByPeriod.forEach((total, p) => {
        const interest = interestByPeriod.get(p) ?? 0;
        const pension = pensionByPeriod.get(p) ?? 0;
        const social = socialByPeriod.get(p) ?? 0;
        const other = Math.max(total - interest - pension - social, 0);
        byPeriod.set(p, {
          period: p,
          [INTEREST_KEY]: interest,
          [PENSION_KEY]: pension,
          [SOCIAL_KEY]: social,
          [OTHER_KEY]: other,
        });
        if (total > 0) shares.push(((interest + pension) / total) * 100);
      });
    }

    const data = Array.from(byPeriod.values()).sort((a, b) => String(a.period).localeCompare(String(b.period)));
    const avg = shares.length ? shares.reduce((sum, v) => sum + v, 0) / shares.length : null;
    return { chartData: data, avgShare: avg };
  }, [view, selectedState, ownTaxRows, ownNonTaxRows, revExpRows, interestRows, pensionRows, socialRows]);

  const revenueColors = { [OWN_TAX_KEY]: colors.ink, [OWN_NON_TAX_KEY]: colors.categorical[2] };
  const expenditureColors = {
    [INTEREST_KEY]: colors.categorical[5],
    [PENSION_KEY]: colors.categorical[4],
    [SOCIAL_KEY]: colors.categorical[1],
    [OTHER_KEY]: colors.muted,
  };
  const seriesColors = view === 'revenue' ? revenueColors : expenditureColors;
  const seriesKeys = view === 'revenue' ? [OWN_TAX_KEY, OWN_NON_TAX_KEY] : [INTEREST_KEY, PENSION_KEY, SOCIAL_KEY, OTHER_KEY];

  return (
    <div className="revenue-spending-mix">
      <h3 className="revenue-spending-mix-title">4 · Revenue &amp; Spending Mix</h3>
      <p className="revenue-spending-mix-desc">
        Two composition views: how a state raises its own money, and how much of its spending is already
        committed before a single new rupee gets allocated.
      </p>

      <div className="revenue-spending-mix-view-toggle" role="radiogroup">
        {(['revenue', 'expenditure'] as ViewMode[]).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={view === v}
            className={`revenue-spending-view-option${view === v ? ' active' : ''}`}
            onClick={() => setView(v)}
          >
            <span className="revenue-spending-view-dot" />
            {v === 'revenue' ? 'Revenue mix' : 'Expenditure priorities'}
          </button>
        ))}
      </div>

      <p className="revenue-spending-mix-subdesc">
        {view === 'revenue'
          ? 'Own tax revenue vs. own non-tax revenue, as a share of the two combined, for one state over time.'
          : 'Interest payments, pensions and social-sector spending as a share of total revenue expenditure, for one state over time. The remainder is grouped as "Other spending".'}
      </p>

      <div className="revenue-spending-mix-control-group">
        <span className="revenue-spending-mix-control-label">State</span>
        <select
          className="revenue-spending-mix-state-select"
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
        >
          {availableStates.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="revenue-spending-mix-error">{error}</div>}

      {!error && (loading || chartData.length === 0) && (
        <div className="revenue-spending-mix-empty">
          {loading ? 'Loading revenue & spending mix…' : 'No data for this state.'}
        </div>
      )}

      {!error && !loading && chartData.length > 0 && (
        <>
          <ExpandableChart title="4 · Revenue & Spending Mix" height={420} className="revenue-spending-mix-chart">
            {(h) => (
              <ResponsiveContainer width="100%" height={h}>
                <AreaChart data={chartData} stackOffset="expand" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid stroke={colors.grid} vertical={false} />
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
                    tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                  />
                  <Tooltip content={(props) => <RevenueSpendingTooltip {...props} />} />
                  <Legend content={(props) => <RevenueSpendingLegend {...props} />} />
                  {seriesKeys.map((key) => (
                    <Area
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stackId="mix"
                      stroke={seriesColors[key as keyof typeof seriesColors]}
                      fill={seriesColors[key as keyof typeof seriesColors]}
                      fillOpacity={0.85}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ExpandableChart>
          <div className="revenue-spending-mix-footnote">
            {selectedState}:{' '}
            {view === 'revenue'
              ? `own tax revenue has averaged ${avgShare != null ? Math.round(avgShare) : '—'}% of own-source revenue across available years.`
              : `interest payments and pensions have averaged ${avgShare != null ? Math.round(avgShare) : '—'}% of revenue expenditure across available years.`}
          </div>
        </>
      )}
    </div>
  );
};

const RevenueSpendingTooltip: React.FC<TooltipContentProps> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const total = payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
  return (
    <div className="revenue-spending-mix-tooltip">
      <div className="revenue-spending-mix-tooltip-period">{label}</div>
      {payload.map((entry) => {
        const value = Number(entry.value) || 0;
        const share = total > 0 ? (value / total) * 100 : 0;
        return (
          <div className="revenue-spending-mix-tooltip-row" key={String(entry.dataKey)}>
            <span className="revenue-spending-mix-tooltip-key" style={{ background: entry.color }} />
            <span className="revenue-spending-mix-tooltip-name">{String(entry.dataKey)}</span>
            <span className="revenue-spending-mix-tooltip-value">{pct(share)}</span>
          </div>
        );
      })}
    </div>
  );
};

const RevenueSpendingLegend: React.FC<DefaultLegendContentProps> = ({ payload }) => {
  if (!payload) return null;
  return (
    <div className="revenue-spending-mix-legend">
      {payload.map((entry) => (
        <span className="revenue-spending-mix-legend-item" key={String(entry.dataKey)}>
          <span className="revenue-spending-mix-legend-dot" style={{ background: entry.color }} />
          {entry.value}
        </span>
      ))}
    </div>
  );
};

export default RevenueSpendingMixChart;
