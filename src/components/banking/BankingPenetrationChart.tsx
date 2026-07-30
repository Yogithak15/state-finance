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
import { fetchSdpFinancialYearSeries, SDP_METRICS } from '../../api/stateDomesticProductApi';
import { rankColor } from '../../utils/rankColor';
import { useTheme, ThemeMode } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import { ExpandableChart } from '../ExpandableChart';
import './BankingPenetrationChart.css';

interface MetricRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

interface PenetrationRow {
  dimensionId: number;
  state: string;
  perLakh: number;
}

type ShowMode = 'top15' | 'bottom15';

const fmt = (v: number) => v.toFixed(1);

const BankingPenetrationChart: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const [year, setYear] = useState<string>('');
  const [show, setShow] = useState<ShowMode>('top15');
  const [officesRows, setOfficesRows] = useState<MetricRow[]>([]);
  const [gsdpRows, setGsdpRows] = useState<MetricRow[]>([]);
  const [perCapitaRows, setPerCapitaRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchBankingFinancialYearSeries(BANKING_METRICS.scbOffices),
      fetchSdpFinancialYearSeries(SDP_METRICS.gsdpCurrent),
      fetchSdpFinancialYearSeries(SDP_METRICS.perCapitaCurrent),
    ])
      .then(([offices, gsdp, perCapita]: [MetricRow[], MetricRow[], MetricRow[]]) => {
        if (cancelled) return;
        setOfficesRows(offices);
        setGsdpRows(gsdp);
        setPerCapitaRows(perCapita);
        const officeYears = new Set(offices.map((r) => r.period));
        const gsdpYears = new Set(gsdp.map((r) => r.period));
        const years = Array.from(officeYears).filter((y) => gsdpYears.has(y)).sort();
        setYear((prev) => (prev && years.includes(prev) ? prev : years[years.length - 1] ?? ''));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load banking penetration data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const availableYears = useMemo(() => {
    const officeYears = new Set(officesRows.map((r) => r.period));
    const gsdpYears = new Set(gsdpRows.map((r) => r.period));
    return Array.from(officeYears)
      .filter((y) => gsdpYears.has(y))
      .sort()
      .reverse();
  }, [officesRows, gsdpRows]);

  const { rows, excludedNames } = useMemo(() => {
    const officesByState = new Map<number, MetricRow>();
    officesRows.filter((r) => r.period === year).forEach((r) => officesByState.set(r.dimension_id, r));
    const gsdpByState = new Map<number, number>();
    gsdpRows.filter((r) => r.period === year).forEach((r) => gsdpByState.set(r.dimension_id, r.value));
    const perCapitaByState = new Map<number, number>();
    perCapitaRows.filter((r) => r.period === year).forEach((r) => perCapitaByState.set(r.dimension_id, r.value));

    const result: PenetrationRow[] = [];
    const excluded: string[] = [];

    officesByState.forEach((row, id) => {
      const gsdp = gsdpByState.get(id);
      const perCapita = perCapitaByState.get(id);
      if (!gsdp || !perCapita || perCapita <= 0) {
        excluded.push(row.dimension_name);
        return;
      }
      const population = gsdp / perCapita;
      if (population <= 0) {
        excluded.push(row.dimension_name);
        return;
      }
      result.push({
        dimensionId: id,
        state: row.dimension_name,
        perLakh: (row.value * 100000) / population,
      });
    });

    return { rows: result.sort((a, b) => b.perLakh - a.perLakh), excludedNames: excluded.sort() };
  }, [officesRows, gsdpRows, perCapitaRows, year]);

  const displayRows = useMemo(() => {
    if (show === 'top15') return rows.slice(0, 15);
    return [...rows.slice(-15)].sort((a, b) => b.perLakh - a.perLakh);
  }, [rows, show]);

  return (
    <div className="banking-penetration">
      <h3 className="banking-penetration-title">5 · Banking Penetration</h3>
      <p className="banking-penetration-desc">
        Raw office counts favour big states. Dividing by population — backed out from the companion GSDP
        and per-capita tables — gives the standard RBI yardstick: bank offices per lakh people.
      </p>

      <div className="banking-penetration-controls">
        <div className="banking-penetration-control">
          <span className="banking-penetration-control-label">Year</span>
          <select
            className="banking-penetration-control-select"
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

        <div className="banking-penetration-control">
          <span className="banking-penetration-control-label">Show</span>
          <div className="banking-penetration-show-toggle" role="radiogroup">
            {([
              { id: 'top15', label: 'Top 15' },
              { id: 'bottom15', label: 'Bottom 15' },
            ] as { id: ShowMode; label: string }[]).map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={show === opt.id}
                className={`banking-penetration-show-option${show === opt.id ? ' active' : ''}`}
                onClick={() => setShow(opt.id)}
              >
                <span className="banking-penetration-show-dot" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="banking-penetration-error">{error}</div>}

      {!error && (loading || displayRows.length === 0) && (
        <div className="banking-penetration-empty">
          {loading ? 'Loading banking penetration…' : 'No data for this year.'}
        </div>
      )}

      {!error && !loading && displayRows.length > 0 && (
        <>
          <ExpandableChart
            title="5 · Banking Penetration"
            height={Math.max(displayRows.length * 32, 120)}
            className="banking-penetration-chart"
          >
            {(h) => (
              <ResponsiveContainer width="100%" height={h}>
                <BarChart
                  data={displayRows}
                  layout="vertical"
                  margin={{ top: 4, right: 60, left: 8, bottom: 4 }}
                  barCategoryGap={6}
                >
                  <CartesianGrid stroke={colors.grid} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12, fill: colors.axisText }}
                    axisLine={{ stroke: colors.grid }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="state"
                    tick={{ fontSize: 12.5, fill: colors.ink }}
                    axisLine={{ stroke: colors.grid }}
                    tickLine={false}
                    width={110}
                  />
                  <Tooltip
                    cursor={false}
                    content={(props) => <PenetrationTooltip {...props} rows={displayRows} theme={theme} />}
                  />
                  <Bar dataKey="perLakh" radius={2} maxBarSize={22} activeBar={{ stroke: 'transparent' }}>
                    {displayRows.map((row, index) => (
                      <Cell key={row.dimensionId} fill={rankColor(index, displayRows.length, theme)} />
                    ))}
                    <LabelList
                      dataKey="perLakh"
                      position="right"
                      formatter={(v: React.ReactNode) => fmt(Number(v))}
                      style={{ fontSize: 11.5, fill: colors.axisText }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ExpandableChart>
          <div className="banking-penetration-footnote">
            SCB offices per lakh population, {year}.
            {excludedNames.length > 0 &&
              ` ${excludedNames.join(', ')} ${excludedNames.length > 1 ? 'are' : 'is'} excluded — not covered by the GSDP tables used to derive population.`}
          </div>
        </>
      )}
    </div>
  );
};

const PenetrationTooltip: React.FC<TooltipContentProps & { rows: PenetrationRow[]; theme: ThemeMode }> = ({
  active,
  payload,
  rows,
  theme,
}) => {
  if (!active || !payload || !payload.length) return null;
  const dimensionId = payload[0]?.payload?.dimensionId as number | undefined;
  const rowIndex = rows.findIndex((r) => r.dimensionId === dimensionId);
  const row = rows[rowIndex];
  if (!row) return null;

  return (
    <div className="banking-penetration-tooltip">
      <span
        className="banking-penetration-tooltip-key"
        style={{ background: rankColor(rowIndex, rows.length, theme) }}
      />
      <span className="banking-penetration-tooltip-name">{row.state}</span>
      <span className="banking-penetration-tooltip-value">{fmt(row.perLakh)} offices per lakh</span>
    </div>
  );
};

export default BankingPenetrationChart;
