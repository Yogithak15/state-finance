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
import { fetchBankingFinancialYearSeries, BANKING_METRICS } from '../../api/bankingApi';
import { fetchSdpFinancialYearSeries, SDP_METRICS } from '../../api/stateDomesticProductApi';
import { formatInrShort } from '../../utils/format';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import { Region, REGION_MAP, REGION_ORDER } from '../../utils/regionMap';
import { ExpandableChart } from '../ExpandableChart';
import './RuralVsUrbanReachChart.css';

interface MetricRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

interface ReachPoint {
  dimensionId: number;
  state: string;
  region: Region | null;
  scbPerLakh: number;
  rrbPerLakh: number;
  deposits: number;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const RuralVsUrbanReachChart: React.FC = () => {
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

  const [officesRows, setOfficesRows] = useState<MetricRow[]>([]);
  const [rrbRows, setRrbRows] = useState<MetricRow[]>([]);
  const [depositsRows, setDepositsRows] = useState<MetricRow[]>([]);
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
      fetchBankingFinancialYearSeries(BANKING_METRICS.rrbBranches),
      fetchBankingFinancialYearSeries(BANKING_METRICS.scbDeposits),
      fetchSdpFinancialYearSeries(SDP_METRICS.gsdpCurrent),
      fetchSdpFinancialYearSeries(SDP_METRICS.perCapitaCurrent),
    ])
      .then(([offices, rrb, deposits, gsdp, perCapita]: [MetricRow[], MetricRow[], MetricRow[], MetricRow[], MetricRow[]]) => {
        if (cancelled) return;
        setOfficesRows(offices);
        setRrbRows(rrb);
        setDepositsRows(deposits);
        setGsdpRows(gsdp);
        setPerCapitaRows(perCapita);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load rural vs urban banking reach data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { points, medianX, medianY, year } = useMemo(() => {
    const officeYears = new Set(officesRows.map((r) => r.period));
    const rrbYears = new Set(rrbRows.map((r) => r.period));
    const depositYears = new Set(depositsRows.map((r) => r.period));
    const gsdpYears = new Set(gsdpRows.map((r) => r.period));
    const commonYears = Array.from(officeYears)
      .filter((y) => rrbYears.has(y) && depositYears.has(y) && gsdpYears.has(y))
      .sort();
    const latestYear = commonYears[commonYears.length - 1] ?? '';
    if (!latestYear) return { points: [] as ReachPoint[], medianX: 0, medianY: 0, year: '' };

    const officesByState = new Map<number, MetricRow>();
    officesRows.filter((r) => r.period === latestYear).forEach((r) => officesByState.set(r.dimension_id, r));
    const rrbByState = new Map<number, number>();
    rrbRows.filter((r) => r.period === latestYear).forEach((r) => rrbByState.set(r.dimension_id, r.value));
    const depositsByState = new Map<number, number>();
    depositsRows.filter((r) => r.period === latestYear).forEach((r) => depositsByState.set(r.dimension_id, r.value));
    const gsdpByState = new Map<number, number>();
    gsdpRows.filter((r) => r.period === latestYear).forEach((r) => gsdpByState.set(r.dimension_id, r.value));
    const perCapitaByState = new Map<number, number>();
    perCapitaRows.filter((r) => r.period === latestYear).forEach((r) => perCapitaByState.set(r.dimension_id, r.value));

    const raw: ReachPoint[] = [];
    officesByState.forEach((row, id) => {
      const gsdp = gsdpByState.get(id);
      const perCapita = perCapitaByState.get(id);
      const rrb = rrbByState.get(id);
      const deposits = depositsByState.get(id);
      if (!gsdp || !perCapita || perCapita <= 0 || rrb == null || !deposits) return;
      const population = gsdp / perCapita;
      if (population <= 0) return;

      raw.push({
        dimensionId: id,
        state: row.dimension_name,
        region: REGION_MAP[row.dimension_name] ?? null,
        scbPerLakh: (row.value * 100000) / population,
        rrbPerLakh: (rrb * 100000) / population,
        deposits,
      });
    });

    return {
      points: raw,
      medianX: raw.length ? median(raw.map((p) => p.scbPerLakh)) : 0,
      medianY: raw.length ? median(raw.map((p) => p.rrbPerLakh)) : 0,
      year: latestYear,
    };
  }, [officesRows, rrbRows, depositsRows, gsdpRows, perCapitaRows]);

  const scaleDomain = useMemo(() => {
    if (!points.length) return [0, 1];
    const values = points.map((p) => p.deposits);
    return [Math.min(...values), Math.max(...values)];
  }, [points]);

  return (
    <div className="rural-urban-reach">
      <h3 className="rural-urban-reach-title">6 · Rural vs Urban Banking Reach</h3>
      <p className="rural-urban-reach-desc">
        Every state plotted by commercial-bank density against regional-rural-bank density — two very
        different parts of India's banking network. Bubble size is total SCB deposits; colour is the
        RBI's own banking region.
      </p>

      {error && <div className="rural-urban-reach-error">{error}</div>}

      {!error && (loading || points.length === 0) && (
        <div className="rural-urban-reach-empty">
          {loading ? 'Loading rural vs urban banking reach…' : 'Not enough overlapping data to plot.'}
        </div>
      )}

      {!error && !loading && points.length > 0 && (
        <>
          <div className="rural-urban-reach-chart-row">
            <span className="rural-urban-axis-title-y">RRB branches per lakh population ({year})</span>
            <ExpandableChart
              title="6 · Rural vs Urban Banking Reach"
              height={380}
              className="rural-urban-reach-chart-plot"
            >
              {(h) => (
                <ResponsiveContainer width="100%" height={h}>
                  <ScatterChart margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid stroke={colors.grid} />
                    <XAxis
                      type="number"
                      dataKey="scbPerLakh"
                      name="SCB offices per lakh population"
                      tick={{ fontSize: 12, fill: colors.axisText }}
                      axisLine={{ stroke: colors.grid }}
                      tickLine={false}
                    />
                    <YAxis
                      type="number"
                      dataKey="rrbPerLakh"
                      name="RRB branches per lakh population"
                      tick={{ fontSize: 12, fill: colors.axisText }}
                      axisLine={{ stroke: colors.grid }}
                      tickLine={false}
                      width={40}
                    />
                    <ZAxis type="number" dataKey="deposits" range={[120, 1800]} domain={scaleDomain} />
                    <Tooltip
                      content={(props) => (
                        <RuralUrbanTooltip {...props} regionColors={regionColors} muted={colors.muted} />
                      )}
                      cursor={{ strokeDasharray: '3 3' }}
                    />
                    <Legend verticalAlign="bottom" content={(props) => <RuralUrbanLegend {...props} />} />
                    <ReferenceLine x={medianX} stroke={colors.muted} strokeDasharray="4 4" />
                    <ReferenceLine y={medianY} stroke={colors.muted} strokeDasharray="4 4" />
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
              )}
            </ExpandableChart>
          </div>
          <span className="rural-urban-axis-title-x">SCB offices per lakh population ({year})</span>
          <div className="rural-urban-reach-footnote">
            Bubble size = total SCB deposits ({year}). Dashed lines mark the median on each axis. States
            high on both axes have dense banking coverage overall; high-RRB/low-SCB states lean on rural
            banking infrastructure specifically.
          </div>
        </>
      )}
    </div>
  );
};

const RuralUrbanTooltip: React.FC<
  TooltipContentProps & { regionColors: Record<Region, string>; muted: string }
> = ({ active, payload, regionColors, muted }) => {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0]?.payload as ReachPoint | undefined;
  if (!point) return null;
  return (
    <div className="rural-urban-reach-tooltip">
      <span
        className="rural-urban-reach-tooltip-key"
        style={{ background: point.region ? regionColors[point.region] : muted }}
      />
      <span className="rural-urban-reach-tooltip-text">
        <strong>{point.state}</strong>: {point.scbPerLakh.toFixed(1)} SCB/lakh, {point.rrbPerLakh.toFixed(1)}{' '}
        RRB/lakh, {formatInrShort(point.deposits)} deposits
      </span>
    </div>
  );
};

const RuralUrbanLegend: React.FC<DefaultLegendContentProps> = ({ payload }) => {
  if (!payload) return null;
  return (
    <div className="rural-urban-reach-legend">
      {payload.map((entry) => (
        <span className="rural-urban-reach-legend-item" key={String(entry.value)}>
          <span className="rural-urban-reach-legend-dot" style={{ background: entry.color }} />
          {entry.value}
        </span>
      ))}
    </div>
  );
};

export default RuralVsUrbanReachChart;
