import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  TooltipContentProps,
  DefaultLegendContentProps,
} from 'recharts';
import { fetchPwFinancialYearSeries, PW_METRICS } from '../../api/priceWagesApi';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import StateSearchSelect from '../sdp/StateSearchSelect';
import { ExpandableChart } from '../ExpandableChart';
import './InflationByCategoryChart.css';

interface MetricRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

const GENERAL_KEY = 'General';
const FOOD_KEY = 'Food & Beverages';
const FUEL_KEY = 'Fuel & Light';
const HOUSING_KEY = 'Housing (Urban)';

const InflationByCategoryChart: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const [generalRows, setGeneralRows] = useState<MetricRow[]>([]);
  const [foodRows, setFoodRows] = useState<MetricRow[]>([]);
  const [fuelRows, setFuelRows] = useState<MetricRow[]>([]);
  const [housingRows, setHousingRows] = useState<MetricRow[]>([]);
  const [selectedState, setSelectedState] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchPwFinancialYearSeries(PW_METRICS.cpiGeneral),
      fetchPwFinancialYearSeries(PW_METRICS.cpiFoodBeverages),
      fetchPwFinancialYearSeries(PW_METRICS.cpiFuelLight),
      fetchPwFinancialYearSeries(PW_METRICS.cpiHousingUrban),
    ])
      .then(([general, food, fuel, housing]: [MetricRow[], MetricRow[], MetricRow[], MetricRow[]]) => {
        if (cancelled) return;
        setGeneralRows(general);
        setFoodRows(food);
        setFuelRows(fuel);
        setHousingRows(housing);
        const names = Array.from(new Set(general.map((r) => r.dimension_name))).sort((a, b) =>
          a.localeCompare(b)
        );
        setSelectedState((prev) => (prev && names.includes(prev) ? prev : names[0] ?? ''));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load inflation by category data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const availableStates = useMemo(
    () => Array.from(new Set(generalRows.map((r) => r.dimension_name))).sort((a, b) => a.localeCompare(b)),
    [generalRows]
  );

  const chartData = useMemo(() => {
    const byPeriod = new Map<string, Record<string, number | string>>();
    const addSeries = (rows: MetricRow[], key: string) => {
      rows
        .filter((r) => r.dimension_name === selectedState)
        .forEach((r) => {
          if (!byPeriod.has(r.period)) byPeriod.set(r.period, { period: r.period });
          (byPeriod.get(r.period) as Record<string, number | string>)[key] = r.value;
        });
    };
    addSeries(generalRows, GENERAL_KEY);
    addSeries(foodRows, FOOD_KEY);
    addSeries(fuelRows, FUEL_KEY);
    addSeries(housingRows, HOUSING_KEY);

    return Array.from(byPeriod.values()).sort((a, b) => String(a.period).localeCompare(String(b.period)));
  }, [generalRows, foodRows, fuelRows, housingRows, selectedState]);

  return (
    <div className="inflation-category">
      <h3 className="inflation-category-title">5 · Inflation by Category</h3>
      <p className="inflation-category-desc">
        Splits headline CPI inflation into its three biggest components — food &amp; beverages, fuel &amp;
        light, and housing (urban) — for one state at a time, so you can see which basket is actually
        driving the number shown in the Inflation Trends tab.
      </p>

      <div className="inflation-category-control-group">
        <span className="inflation-category-control-label">State</span>
        <StateSearchSelect states={availableStates} value={selectedState} onChange={setSelectedState} />
      </div>

      {error && <div className="inflation-category-error">{error}</div>}

      {!error && (loading || chartData.length === 0) && (
        <div className="inflation-category-empty">
          {loading ? 'Loading inflation by category…' : 'No data for this state.'}
        </div>
      )}

      {!error && !loading && chartData.length > 0 && (
        <>
          <ExpandableChart title="5 · Inflation by Category" height={380} className="inflation-category-chart">
            {(h) => (
            <ResponsiveContainer width="100%" height={h}>
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
                  tickFormatter={(v: number) => `${Math.round(v)}%`}
                  width={48}
                />
                <Tooltip content={(props) => <InflationCategoryTooltip {...props} />} />
                <Legend content={(props) => <InflationCategoryLegend {...props} />} />
                <Line
                  type="monotone"
                  dataKey={GENERAL_KEY}
                  stroke={colors.ink}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 3, fill: colors.ink, stroke: colors.surface, strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: colors.ink, stroke: colors.surface, strokeWidth: 2 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey={FOOD_KEY}
                  stroke={colors.categorical[5]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: colors.categorical[5], stroke: colors.surface, strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: colors.categorical[5], stroke: colors.surface, strokeWidth: 2 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey={FUEL_KEY}
                  stroke={colors.categorical[2]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: colors.categorical[2], stroke: colors.surface, strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: colors.categorical[2], stroke: colors.surface, strokeWidth: 2 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey={HOUSING_KEY}
                  stroke={colors.categorical[1]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: colors.categorical[1], stroke: colors.surface, strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: colors.categorical[1], stroke: colors.surface, strokeWidth: 2 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
            )}
          </ExpandableChart>
          <div className="inflation-category-footnote">
            {selectedState}: General CPI inflation split into its three largest components. A blank
            segment means that category had no published figure for {selectedState} that year.
          </div>
        </>
      )}
    </div>
  );
};

const InflationCategoryTooltip: React.FC<TooltipContentProps> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const sorted = [...payload].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  return (
    <div className="inflation-category-tooltip">
      <div className="inflation-category-tooltip-period">{label}</div>
      {sorted.map((entry) => (
        <div className="inflation-category-tooltip-row" key={String(entry.dataKey)}>
          <span className="inflation-category-tooltip-key" style={{ background: entry.color }} />
          <span className="inflation-category-tooltip-value">{Number(entry.value).toFixed(1)}%</span>
          <span className="inflation-category-tooltip-name">{String(entry.dataKey)}</span>
        </div>
      ))}
    </div>
  );
};

const InflationCategoryLegend: React.FC<DefaultLegendContentProps> = ({ payload }) => {
  if (!payload) return null;
  return (
    <div className="inflation-category-legend">
      {payload.map((entry) => (
        <span className="inflation-category-legend-item" key={String(entry.dataKey)}>
          <span className="inflation-category-legend-dot" style={{ background: entry.color }} />
          {entry.value}
        </span>
      ))}
    </div>
  );
};

export default InflationByCategoryChart;
