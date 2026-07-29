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
import { fetchPwFinancialYearSeries, PW_METRICS } from '../../api/priceWagesApi';
import { rankColor } from '../../utils/rankColor';
import { useTheme, ThemeMode } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import './PwStateRankingsChart.css';

interface MetricRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

type ShowMode = 'top15' | 'bottom15' | 'all';

const pct = (v: number) => `${v.toFixed(1)}%`;

const PwStateRankingsChart: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const [year, setYear] = useState<string>('');
  const [show, setShow] = useState<ShowMode>('top15');
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPwFinancialYearSeries(PW_METRICS.cpiGeneral)
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
  }, []);

  const availableYears = useMemo(
    () => Array.from(new Set(rows.map((r) => r.period))).sort().reverse(),
    [rows]
  );

  const yearRows = useMemo(
    () => rows.filter((r) => r.period === year).sort((a, b) => b.value - a.value),
    [rows, year]
  );

  const allIndiaForYear = useMemo(
    () => (yearRows.length ? yearRows.reduce((sum, r) => sum + r.value, 0) / yearRows.length : null),
    [yearRows]
  );

  const displayRows = useMemo(() => {
    if (show === 'top15') return yearRows.slice(0, 15);
    if (show === 'bottom15') return [...yearRows.slice(-15)].sort((a, b) => b.value - a.value);
    return yearRows;
  }, [yearRows, show]);

  const showOptions: { id: ShowMode; label: string }[] = [
    { id: 'top15', label: 'Top 15' },
    { id: 'bottom15', label: 'Bottom 15' },
    { id: 'all', label: `All (${yearRows.length})` },
  ];

  return (
    <div className="pw-rankings">
      <h3 className="pw-rankings-title">2 · State Rankings</h3>
      <p className="pw-rankings-desc">
        Which states ran the hottest — or coolest — consumer price inflation in any given year.
      </p>

      <div className="pw-rankings-controls">
        <div className="pw-control">
          <span className="pw-control-label">Year</span>
          <select className="pw-control-select" value={year} onChange={(e) => setYear(e.target.value)}>
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="pw-control">
          <span className="pw-control-label">Show</span>
          <div className="pw-show-toggle" role="radiogroup">
            {showOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={show === opt.id}
                className={`pw-show-option${show === opt.id ? ' active' : ''}`}
                onClick={() => setShow(opt.id)}
              >
                <span className="pw-show-dot" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="pw-rankings-error">{error}</div>}

      {!error && (loading || displayRows.length === 0) && (
        <div className="pw-rankings-empty">
          {loading ? 'Loading state rankings…' : 'No data for this year.'}
        </div>
      )}

      {!error && !loading && displayRows.length > 0 && (
        <>
          <div className="pw-rankings-chart" style={{ height: Math.max(displayRows.length * 32, 120) }}>
            <ResponsiveContainer width="100%" height="100%">
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
                  tickFormatter={(v: number) => pct(v)}
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
                  content={(props) => <PwRankingsTooltip {...props} rows={displayRows} theme={theme} />}
                />
                <Bar dataKey="value" radius={2} maxBarSize={22} activeBar={{ stroke: 'transparent' }}>
                  {displayRows.map((row, index) => (
                    <Cell key={row.dimension_id} fill={rankColor(index, displayRows.length, theme)} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    formatter={(v: React.ReactNode) => pct(Number(v))}
                    style={{ fontSize: 11.5, fill: colors.axisText }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="pw-rankings-footnote">
            CPI (General) inflation · {year} · {displayRows.length} of {yearRows.length} states/UTs with data
            shown.
            {allIndiaForYear != null && ` All-India that year: ${allIndiaForYear >= 0 ? '+' : ''}${pct(allIndiaForYear)}.`}
          </div>
        </>
      )}
    </div>
  );
};

const PwRankingsTooltip: React.FC<TooltipContentProps & { rows: MetricRow[]; theme: ThemeMode }> = ({
  active,
  payload,
  rows,
  theme,
}) => {
  if (!active || !payload || !payload.length) return null;
  const dimensionId = payload[0]?.payload?.dimension_id as number | undefined;
  const rowIndex = rows.findIndex((r) => r.dimension_id === dimensionId);
  const row = rows[rowIndex];
  if (!row) return null;

  return (
    <div className="pw-rankings-tooltip">
      <span className="pw-rankings-tooltip-key" style={{ background: rankColor(rowIndex, rows.length, theme) }} />
      <span className="pw-rankings-tooltip-name">{row.dimension_name}</span>
      <span className="pw-rankings-tooltip-value">{pct(row.value)}</span>
    </div>
  );
};

export default PwStateRankingsChart;
