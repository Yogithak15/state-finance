import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  TooltipContentProps,
  DefaultLegendContentProps,
} from 'recharts';
import { fetchPwFinancialYearSeries, PW_METRICS } from '../../api/priceWagesApi';
import { fetchSdpFinancialYearSeries, SDP_METRICS } from '../../api/stateDomesticProductApi';
import { RBI_TARGET_CENTER } from '../../utils/bandColor';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import { Region, REGION_MAP, REGION_ORDER } from '../../utils/regionMap';
import './PwInflationVsGrowthChart.css';

interface MetricRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

interface StatePoint {
  dimensionId: number;
  state: string;
  region: Region | null;
  avgInflation: number;
  cagr: number;
  scale: number;
}

const fyYear = (period: string) => Number(period.slice(0, 4));

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const PwInflationVsGrowthChart: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const regionColors = useMemo(
    () =>
      REGION_ORDER.reduce((acc, region, i) => {
        acc[region] = colors.categorical[i % colors.categorical.length];
        return acc;
      }, {} as Record<Region, string>),
    [colors]
  );

  const [inflationRows, setInflationRows] = useState<MetricRow[]>([]);
  const [growthRows, setGrowthRows] = useState<MetricRow[]>([]);
  const [scaleRows, setScaleRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchPwFinancialYearSeries(PW_METRICS.cpiGeneral),
      fetchSdpFinancialYearSeries(SDP_METRICS.perCapitaConstant),
      fetchSdpFinancialYearSeries(SDP_METRICS.gsdpCurrent),
    ])
      .then(([inflation, growth, scale]: [MetricRow[], MetricRow[], MetricRow[]]) => {
        if (cancelled) return;
        setInflationRows(inflation);
        setGrowthRows(growth);
        setScaleRows(scale);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load inflation vs growth data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const inflationYearRange = useMemo(() => {
    const periods = Array.from(new Set(inflationRows.map((r) => r.period))).sort();
    return { start: periods[0] ?? '', end: periods[periods.length - 1] ?? '' };
  }, [inflationRows]);

  const { points, medianY, excludedFromInflation, excludedFromSdp } = useMemo(() => {
    const anchorPeriod = inflationYearRange.start;
    if (!anchorPeriod) {
      return { points: [] as StatePoint[], medianY: 0, excludedFromInflation: [] as string[], excludedFromSdp: [] as string[] };
    }

    const nameFor = new Map<number, string>();
    [...inflationRows, ...growthRows, ...scaleRows].forEach((r) => nameFor.set(r.dimension_id, r.dimension_name));

    const avgInflationByState = new Map<number, number>();
    const inflationByStateAll = new Map<number, number[]>();
    inflationRows.forEach((r) => {
      if (!inflationByStateAll.has(r.dimension_id)) inflationByStateAll.set(r.dimension_id, []);
      inflationByStateAll.get(r.dimension_id)!.push(r.value);
    });
    inflationByStateAll.forEach((values, id) => {
      avgInflationByState.set(id, values.reduce((sum, v) => sum + v, 0) / values.length);
    });

    const growthByState = new Map<number, MetricRow[]>();
    growthRows.forEach((r) => {
      if (!growthByState.has(r.dimension_id)) growthByState.set(r.dimension_id, []);
      growthByState.get(r.dimension_id)!.push(r);
    });
    const cagrByState = new Map<number, number>();
    growthByState.forEach((rows, id) => {
      const sorted = [...rows].sort((a, b) => a.period.localeCompare(b.period));
      const start = sorted.find((r) => r.period === anchorPeriod);
      const end = sorted[sorted.length - 1];
      if (!start || !end || start.value <= 0) return;
      const years = fyYear(end.period) - fyYear(start.period);
      if (years <= 0) return;
      cagrByState.set(id, (Math.pow(end.value / start.value, 1 / years) - 1) * 100);
    });

    const latestScalePeriod = scaleRows.reduce((max, r) => (r.period > max ? r.period : max), '');
    const scaleByState = new Map<number, number>();
    scaleRows.filter((r) => r.period === latestScalePeriod).forEach((r) => scaleByState.set(r.dimension_id, r.value));

    const allIds = new Set([...Array.from(avgInflationByState.keys()), ...Array.from(cagrByState.keys())]);

    const raw: StatePoint[] = [];
    const missingInflation: string[] = [];
    const missingSdp: string[] = [];

    allIds.forEach((id) => {
      const hasInflation = avgInflationByState.has(id);
      const hasGrowth = cagrByState.has(id);
      const hasScale = scaleByState.has(id);
      const name = nameFor.get(id) ?? '';

      if (hasGrowth && hasScale && !hasInflation) missingInflation.push(name);
      if (hasInflation && !(hasGrowth && hasScale)) missingSdp.push(name);

      if (hasInflation && hasGrowth && hasScale) {
        raw.push({
          dimensionId: id,
          state: name,
          region: REGION_MAP[name] ?? null,
          avgInflation: avgInflationByState.get(id) as number,
          cagr: cagrByState.get(id) as number,
          scale: scaleByState.get(id) as number,
        });
      }
    });

    const med = raw.length ? median(raw.map((p) => p.cagr)) : 0;

    return {
      points: raw,
      medianY: med,
      excludedFromInflation: missingInflation.sort(),
      excludedFromSdp: missingSdp.sort(),
    };
  }, [inflationRows, growthRows, scaleRows, inflationYearRange]);

  const scaleDomain = useMemo(() => {
    if (!points.length) return [0, 1];
    const values = points.map((p) => p.scale);
    return [Math.min(...values), Math.max(...values)];
  }, [points]);

  return (
    <div className="pw-inflation-growth">
      <h3 className="pw-inflation-growth-title">4 · Inflation vs Real Growth</h3>
      <p className="pw-inflation-growth-desc">
        Cross-referencing the price data against the companion growth tables: does running hotter
        inflation actually buy a state faster real growth, or just erode it? Each bubble is a state's
        decade-long average inflation against its real per-capita growth rate.
      </p>

      {error && <div className="pw-inflation-growth-error">{error}</div>}

      {!error && (loading || points.length === 0) && (
        <div className="pw-inflation-growth-empty">
          {loading ? 'Loading inflation vs growth data…' : 'Not enough overlapping data to plot.'}
        </div>
      )}

      {!error && !loading && points.length > 0 && (
        <>
          <div className="pw-inflation-growth-chart-row">
            <span className="pw-axis-title-y">Real per-capita growth, CAGR since {inflationYearRange.start}</span>
            <div className="pw-inflation-growth-chart-plot">
              <ResponsiveContainer width="100%" height={460}>
                <ScatterChart margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid stroke={colors.grid} />
                  <XAxis
                    type="number"
                    dataKey="avgInflation"
                    name="Average CPI inflation"
                    tick={{ fontSize: 12, fill: colors.axisText }}
                    axisLine={{ stroke: colors.grid }}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                  />
                  <YAxis
                    type="number"
                    dataKey="cagr"
                    name="Real per-capita growth"
                    tick={{ fontSize: 12, fill: colors.axisText }}
                    axisLine={{ stroke: colors.grid }}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                    width={48}
                  />
                  <ZAxis type="number" dataKey="scale" range={[120, 1800]} domain={scaleDomain} />
                  <Tooltip
                    content={(props) => <PwInflationGrowthTooltip {...props} regionColors={regionColors} muted={colors.muted} />}
                    cursor={{ strokeDasharray: '3 3' }}
                  />
                  <Legend verticalAlign="bottom" content={(props) => <PwInflationGrowthLegend {...props} />} />
                  <ReferenceLine
                    x={RBI_TARGET_CENTER}
                    stroke={colors.muted}
                    strokeDasharray="4 4"
                    label={{ value: 'RBI 4% target', position: 'insideTopLeft', fill: colors.axisText, fontSize: 11 }}
                  />
                  <ReferenceLine
                    y={medianY}
                    stroke={colors.muted}
                    strokeDasharray="4 4"
                    label={{
                      value: `Median growth: ${medianY.toFixed(1)}%`,
                      position: 'insideBottomLeft',
                      fill: colors.axisText,
                      fontSize: 11,
                    }}
                  />
                  {REGION_ORDER.map((region) => (
                    <Scatter
                      key={region}
                      name={region}
                      data={points.filter((p) => p.region === region)}
                      fill={regionColors[region]}
                      fillOpacity={0.7}
                      stroke={regionColors[region]}
                      strokeWidth={1}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
          <span className="pw-axis-title-x">
            Average CPI inflation, {inflationYearRange.start} to {inflationYearRange.end}
          </span>
          <div className="pw-inflation-growth-footnote">
            Bubble size = latest available GSDP. Vertical dashed line marks RBI's 4% inflation target;
            horizontal line marks the median real growth rate. Limited to the {points.length} states/UTs
            common to both tables
            {(excludedFromInflation.length > 0 || excludedFromSdp.length > 0) && (
              <>
                {' '}
                (excludes{' '}
                {excludedFromInflation.length > 0 && `${excludedFromInflation.join(', ')}, not in the inflation series`}
                {excludedFromInflation.length > 0 && excludedFromSdp.length > 0 && '; and '}
                {excludedFromSdp.length > 0 && `${excludedFromSdp.join(', ')}, not in the SDP series`}
                ).
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const PwInflationGrowthTooltip: React.FC<
  TooltipContentProps & { regionColors: Record<Region, string>; muted: string }
> = ({ active, payload, regionColors, muted }) => {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0]?.payload as StatePoint | undefined;
  if (!point) return null;
  return (
    <div className="pw-inflation-growth-tooltip">
      <span
        className="pw-inflation-growth-tooltip-key"
        style={{ background: point.region ? regionColors[point.region] : muted }}
      />
      <span className="pw-inflation-growth-tooltip-text">
        <strong>{point.state}</strong>: {point.avgInflation.toFixed(1)}% avg inflation,{' '}
        {point.cagr >= 0 ? '+' : ''}
        {point.cagr.toFixed(1)}% real CAGR
      </span>
    </div>
  );
};

const PwInflationGrowthLegend: React.FC<DefaultLegendContentProps> = ({ payload }) => {
  if (!payload) return null;
  return (
    <div className="pw-inflation-growth-legend">
      {payload.map((entry) => (
        <span className="pw-inflation-growth-legend-item" key={String(entry.value)}>
          <span className="pw-inflation-growth-legend-dot" style={{ background: entry.color }} />
          {entry.value}
        </span>
      ))}
    </div>
  );
};

export default PwInflationVsGrowthChart;
