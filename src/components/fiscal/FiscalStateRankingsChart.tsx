import React, { useEffect, useMemo, useState } from 'react';
import { fetchFiscalFinancialYearSeries, FISCAL_METRICS } from '../../api/fiscalApi';
import { formatInrShort } from '../../utils/format';
import { rankColor } from '../../utils/rankColor';
import { useTheme } from '../../theme/ThemeContext';
import './FiscalStateRankingsChart.css';

interface MetricRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

const METRIC_OPTIONS = [
  { id: FISCAL_METRICS.grossFiscalDeficit, label: 'Gross Fiscal Deficit' },
  { id: FISCAL_METRICS.revenueDeficit, label: 'Revenue Deficit' },
  { id: FISCAL_METRICS.primaryDeficit, label: 'Primary Deficit' },
  { id: FISCAL_METRICS.revenueExpenditure, label: 'Revenue Expenditure' },
  { id: FISCAL_METRICS.ownTaxRevenue, label: 'Own Tax Revenue' },
  { id: FISCAL_METRICS.ownNonTaxRevenue, label: 'Own Non-Tax Revenue' },
  { id: FISCAL_METRICS.interestPayments, label: 'Interest Payments' },
  { id: FISCAL_METRICS.pensionExpenditure, label: 'Pension' },
  { id: FISCAL_METRICS.capitalReceipts, label: 'Capital Receipts' },
  { id: FISCAL_METRICS.capitalExpenditure, label: 'Capital Expenditure' },
  { id: FISCAL_METRICS.capitalOutlay, label: 'Capital Outlay' },
  { id: FISCAL_METRICS.socialSectorExpenditure, label: 'Social Sector Expenditure' },
  { id: FISCAL_METRICS.outstandingGuarantees, label: 'Outstanding Guarantees' },
];

type ShowMode = 'top15' | 'bottom15' | 'all';

const FiscalStateRankingsChart: React.FC = () => {
  const { theme } = useTheme();
  const [metricId, setMetricId] = useState<number>(FISCAL_METRICS.grossFiscalDeficit);
  const [year, setYear] = useState<string>('');
  const [show, setShow] = useState<ShowMode>('top15');
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchFiscalFinancialYearSeries(metricId)
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

  // Rank position within the FULL year list (not just the displayed slice) —
  // "Bottom 15" should still read as ranks 17-31, not restart at 1.
  const rankOf = (dimensionId: number) => yearRows.findIndex((r) => r.dimension_id === dimensionId);

  return (
    <div className="fiscal-rankings">
      <h3 className="fiscal-rankings-title">3 · State Rankings</h3>
      <p className="fiscal-rankings-desc">
        Any one of thirteen fiscal indicators, any year—sorted so you can see who's spending, taxing, or
        borrowing the most.
      </p>

      <div className="fiscal-rankings-controls">
        <div className="fiscal-rankings-control">
          <span className="fiscal-rankings-control-label">Metric</span>
          <select
            className="fiscal-rankings-control-select"
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

        <div className="fiscal-rankings-control">
          <span className="fiscal-rankings-control-label">Year</span>
          <select
            className="fiscal-rankings-control-select"
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

        <div className="fiscal-rankings-control">
          <span className="fiscal-rankings-control-label">Show</span>
          <div className="fiscal-rankings-show-toggle" role="radiogroup">
            {showOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={show === opt.id}
                className={`fiscal-rankings-show-option${show === opt.id ? ' active' : ''}`}
                onClick={() => setShow(opt.id)}
              >
                <span className="fiscal-rankings-show-dot" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="fiscal-rankings-error">{error}</div>}

      {!error && (loading || displayRows.length === 0) && (
        <div className="fiscal-rankings-empty">
          {loading ? 'Loading state rankings…' : 'No data for this year/metric.'}
        </div>
      )}

      {!error && !loading && displayRows.length > 0 && (
        <>
          <div className="fiscal-rankings-list">
            {displayRows.map((row) => {
              const index = rankOf(row.dimension_id);
              return (
                <div className="fiscal-rankings-row" key={row.dimension_id}>
                  <span className="fiscal-rankings-row-rank">{index + 1}</span>
                  <span
                    className="fiscal-rankings-row-dot"
                    style={{ background: rankColor(index, yearRows.length, theme) }}
                  />
                  <span className="fiscal-rankings-row-name">{row.dimension_name}</span>
                  <span className="fiscal-rankings-row-value">{formatInrShort(row.value)}</span>
                </div>
              );
            })}
          </div>
          <div className="fiscal-rankings-footnote">
            {metric.label} · {year} · {displayRows.length} of {yearRows.length} states/UTs with data shown.
            Positive deficit figures denote a deficit; negative denotes a surplus.
          </div>
        </>
      )}
    </div>
  );
};

export default FiscalStateRankingsChart;
