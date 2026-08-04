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
  LabelList,
  TooltipContentProps,
  DefaultLegendContentProps,
} from 'recharts';
import { fetchSdpFinancialYearSeries, SDP_METRICS } from '../../api/stateDomesticProductApi';
import { formatInr } from '../../utils/format';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import { Region, REGION_MAP, REGION_ORDER } from '../../utils/regionMap';
import { ExpandableChart } from '../ExpandableChart';
import './GrowthVsProsperityChart.css';

interface MetricRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

// A state more than this many points below its region's mean CAGR reads as an
// isolated underperformer relative to its neighbours, not just noise.
const REGION_OUTLIER_GAP = 2;

interface StatePoint {
  dimensionId: number;
  state: string;
  region: Region | null;
  perCapita: number;
  cagr: number;
  scale: number;
  outlierLabel: string;
}

const fyYear = (period: string) => Number(period.slice(0, 4));

const GrowthVsProsperityChart: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  // Same validated categorical palette used across this section — first 7
  // slots, fixed order, one per region.
  const regionColors = useMemo(
    () =>
      REGION_ORDER.reduce((acc, region, i) => {
        acc[region] = colors.categorical[i % colors.categorical.length];
        return acc;
      }, {} as Record<Region, string>),
    [colors]
  );
  const [perCapitaCurrentRows, setPerCapitaCurrentRows] = useState<MetricRow[]>([]);
  const [perCapitaConstantRows, setPerCapitaConstantRows] = useState<MetricRow[]>([]);
  const [gsdpCurrentRows, setGsdpCurrentRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchSdpFinancialYearSeries(SDP_METRICS.perCapitaCurrent),
      fetchSdpFinancialYearSeries(SDP_METRICS.perCapitaConstant),
      fetchSdpFinancialYearSeries(SDP_METRICS.gsdpCurrent),
    ])
      .then(([current, constant, gsdp]: [MetricRow[], MetricRow[], MetricRow[]]) => {
        if (cancelled) return;
        setPerCapitaCurrentRows(current);
        setPerCapitaConstantRows(constant);
        setGsdpCurrentRows(gsdp);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load growth vs prosperity data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { points, avgX, avgY } = useMemo(() => {
    if (!perCapitaCurrentRows.length) return { points: [] as StatePoint[], avgX: 0, avgY: 0 };

    const latestPeriod = perCapitaCurrentRows.reduce((max, r) => (r.period > max ? r.period : max), '');

    const gsdpByState = new Map<number, number>();
    gsdpCurrentRows.filter((r) => r.period === latestPeriod).forEach((r) => gsdpByState.set(r.dimension_id, r.value));

    const constantByState = new Map<number, MetricRow[]>();
    perCapitaConstantRows.forEach((r) => {
      if (!constantByState.has(r.dimension_id)) constantByState.set(r.dimension_id, []);
      constantByState.get(r.dimension_id)!.push(r);
    });

    const raw: StatePoint[] = [];
    perCapitaCurrentRows
      .filter((r) => r.period === latestPeriod)
      .forEach((r) => {
        const constantSeries = (constantByState.get(r.dimension_id) ?? []).sort((a, b) =>
          a.period.localeCompare(b.period)
        );
        if (constantSeries.length < 2) return;
        const first = constantSeries[0];
        const last = constantSeries[constantSeries.length - 1];
        const years = fyYear(last.period) - fyYear(first.period);
        if (years <= 0 || first.value <= 0) return;
        const cagr = (Math.pow(last.value / first.value, 1 / years) - 1) * 100;
        const scale = gsdpByState.get(r.dimension_id) ?? 0;
        if (scale <= 0) return;

        raw.push({
          dimensionId: r.dimension_id,
          state: r.dimension_name,
          region: REGION_MAP[r.dimension_name] ?? null,
          perCapita: r.value,
          cagr,
          scale,
          outlierLabel: '',
        });
      });

    const meanX = raw.reduce((sum, p) => sum + p.perCapita, 0) / raw.length;
    const meanY = raw.reduce((sum, p) => sum + p.cagr, 0) / raw.length;

    const regionMeans = new Map<Region, number>();
    REGION_ORDER.forEach((region) => {
      const members = raw.filter((p) => p.region === region);
      if (members.length >= 2) {
        regionMeans.set(region, members.reduce((sum, p) => sum + p.cagr, 0) / members.length);
      }
    });

    raw.forEach((p) => {
      const richButSlowing = p.perCapita > meanX && p.cagr < meanY;
      const regionMean = p.region ? regionMeans.get(p.region) : undefined;
      const regionOutlier = regionMean != null && regionMean - p.cagr > REGION_OUTLIER_GAP;
      p.outlierLabel = richButSlowing || regionOutlier ? p.state : '';
    });

    return { points: raw, avgX: meanX, avgY: meanY };
  }, [perCapitaCurrentRows, perCapitaConstantRows, gsdpCurrentRows]);

  const scaleDomain = useMemo(() => {
    if (!points.length) return [0, 1];
    const values = points.map((p) => p.scale);
    return [Math.min(...values), Math.max(...values)];
  }, [points]);

  return (
    <div className="growth-vs-prosperity">
      <h3 className="growth-vs-prosperity-title">7 · Growth vs Prosperity</h3>
      <p className="growth-vs-prosperity-desc">
        A bubble chart plots where each state sits on two axes at once — how rich it already is, and how
        fast it has grown in real per-capita terms — with bubble size for economic scale and colour for
        region.
      </p>

      {error && <div className="growth-vs-prosperity-error">{error}</div>}

      {!error && (loading || points.length === 0) && (
        <div className="growth-vs-prosperity-empty">
          {loading ? 'Loading growth vs prosperity data…' : 'Not enough data to plot.'}
        </div>
      )}

      {!error && !loading && points.length > 0 && (
        <>
          <div className="growth-vs-prosperity-chart-wrap">
            <div className="growth-vs-prosperity-chart-row">
              <span className="axis-title-y">Real per-capita growth, full period (CAGR %)</span>

              <ExpandableChart
                title="7 · Growth vs Prosperity"
                height={380}
                className="growth-vs-prosperity-chart-plot"
              >
                {(h) => (
                  <>
                    <span className="quadrant-label quadrant-top-right">Rich &amp; accelerating</span>
                    <span className="quadrant-label quadrant-bottom-right">Rich, but slowing</span>
                    <span className="quadrant-label quadrant-top-left">Poor, but catching up</span>
                    <span className="quadrant-label quadrant-bottom-left">Poor, falling behind</span>

                    <ResponsiveContainer width="100%" height={h}>
                      <ScatterChart margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid stroke={colors.grid} />
                        <XAxis
                          type="number"
                          dataKey="perCapita"
                          name="Per-capita NSDP"
                          tick={{ fontSize: 12, fill: colors.axisText }}
                          axisLine={{ stroke: colors.grid }}
                          tickLine={false}
                          tickFormatter={(v: number) => formatInr(v)}
                        />
                        <YAxis
                          type="number"
                          dataKey="cagr"
                          name="Real per-capita growth"
                          tick={{ fontSize: 12, fill: colors.axisText }}
                          axisLine={{ stroke: colors.grid }}
                          tickLine={false}
                          tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                          width={56}
                        />
                        <ZAxis type="number" dataKey="scale" range={[120, 1800]} domain={scaleDomain} />
                        <Tooltip
                          content={(props) => <GrowthVsProsperityTooltip {...props} regionColors={regionColors} muted={colors.muted} />}
                          cursor={{ strokeDasharray: '3 3' }}
                        />
                        <Legend verticalAlign="bottom" content={(props) => <GrowthVsProsperityLegend {...props} />} />
                        <ReferenceLine
                          x={avgX}
                          stroke={colors.muted}
                          strokeDasharray="4 4"
                          label={{
                            value: `Avg per-capita: ${formatInr(avgX)}`,
                            position: 'insideTopRight',
                            fill: colors.axisText,
                            fontSize: 11,
                          }}
                        />
                        <ReferenceLine
                          y={avgY}
                          stroke={colors.muted}
                          strokeDasharray="4 4"
                          label={{
                            value: `Avg growth: ${avgY.toFixed(1)}%`,
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
                          >
                            <LabelList
                              dataKey="outlierLabel"
                              content={(props) => <OutlierLabel {...props} ink={colors.ink} surface={colors.surface} />}
                            />
                          </Scatter>
                        ))}
                      </ScatterChart>
                    </ResponsiveContainer>
                  </>
                )}
              </ExpandableChart>
            </div>
            <span className="axis-title-x">Per-capita NSDP, latest year (current prices)</span>
          </div>
          <div className="growth-vs-prosperity-footnote">
            Bubble size = latest available GSDP (economic scale). Dashed lines mark the average per-capita
            income and average growth rate across all states/UTs. Regions follow India's Zonal Council
            groupings.
          </div>
        </>
      )}
    </div>
  );
};

const OutlierLabel: React.FC<any> = (props) => {
  const { x, y, value, ink, surface } = props;
  if (!value) return null;
  return (
    <text
      x={x}
      y={y - 18}
      textAnchor="middle"
      fontSize={11}
      fontWeight={700}
      fill={ink}
      stroke={surface}
      strokeWidth={3}
      paintOrder="stroke"
    >
      {value}
    </text>
  );
};

const GrowthVsProsperityTooltip: React.FC<
  TooltipContentProps & { regionColors: Record<Region, string>; muted: string }
> = ({ active, payload, regionColors, muted }) => {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0]?.payload as StatePoint | undefined;
  if (!point) return null;
  return (
    <div className="growth-vs-prosperity-tooltip">
      <span
        className="growth-vs-prosperity-tooltip-key"
        style={{ background: point.region ? regionColors[point.region] : muted }}
      />
      <span className="growth-vs-prosperity-tooltip-text">
        <strong>{point.state}</strong>: {formatInr(point.perCapita)} per-capita, {point.cagr >= 0 ? '+' : ''}
        {point.cagr.toFixed(1)}% real CAGR
      </span>
    </div>
  );
};

const GrowthVsProsperityLegend: React.FC<DefaultLegendContentProps> = ({ payload }) => {
  if (!payload) return null;
  return (
    <div className="growth-vs-prosperity-legend">
      {payload.map((entry) => (
        <span className="growth-vs-prosperity-legend-item" key={String(entry.value)}>
          <span className="growth-vs-prosperity-legend-dot" style={{ background: entry.color }} />
          {entry.value}
        </span>
      ))}
    </div>
  );
};

export default GrowthVsProsperityChart;
