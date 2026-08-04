import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  TooltipContentProps,
  DefaultLegendContentProps,
} from 'recharts';
import {
  fetchFiscalFinancialYearSeries,
  FISCAL_METRICS,
  FISCAL_DEFICIT_GSDP_LIMIT,
} from '../../api/fiscalApi';
import { fetchSdpFinancialYearSeries, SDP_METRICS } from '../../api/stateDomesticProductApi';
import { formatInrShort } from '../../utils/format';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import { Region, REGION_MAP, REGION_ORDER } from '../../utils/regionMap';
import { ExpandableChart } from '../ExpandableChart';
import './FiscalStressMapChart.css';

interface MetricRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

interface StressPoint {
  dimensionId: number;
  state: string;
  region: Region | null;
  debtPct: number;
  deficitPct: number;
  scale: number;
  color: string;
  selected: boolean;
}

// Round-number visual thresholds for the quadrant framing, not a specific
// regulator's ceiling (that's FISCAL_DEFICIT_GSDP_LIMIT below, from the FRBM
// Act) — kept separate and labelled "illustrative" rather than cited.
const STRESS_DEBT_THRESHOLD = 25;

const GOLD_HIGHLIGHT = '#d4a017';

const RADIUS_RANGE: [number, number] = [7, 34];

const pct = (v: number) => `${v.toFixed(1)}%`;

const FiscalStressMapChart: React.FC = () => {
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

  const [gfdRows, setGfdRows] = useState<MetricRow[]>([]);
  const [liabilitiesRows, setLiabilitiesRows] = useState<MetricRow[]>([]);
  const [gsdpRows, setGsdpRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [compared, setCompared] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchFiscalFinancialYearSeries(FISCAL_METRICS.grossFiscalDeficit),
      fetchFiscalFinancialYearSeries(FISCAL_METRICS.outstandingLiabilities),
      fetchSdpFinancialYearSeries(SDP_METRICS.gsdpCurrent),
    ])
      .then(([gfd, liabilities, gsdp]: [MetricRow[], MetricRow[], MetricRow[]]) => {
        if (cancelled) return;
        setGfdRows(gfd);
        setLiabilitiesRows(liabilities);
        setGsdpRows(gsdp);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load fiscal stress map data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { points, year, radiusFor } = useMemo(() => {
    if (!gsdpRows.length) return { points: [] as StressPoint[], year: '', radiusFor: (_: number) => RADIUS_RANGE[0] };

    const byPeriod = (rows: MetricRow[]) => {
      const map = new Map<string, Map<number, number>>();
      rows.forEach((r) => {
        if (!map.has(r.period)) map.set(r.period, new Map());
        map.get(r.period)!.set(r.dimension_id, r.value);
      });
      return map;
    };
    const gfdByPeriod = byPeriod(gfdRows);
    const liabilitiesByPeriod = byPeriod(liabilitiesRows);
    const gsdpByPeriod = byPeriod(gsdpRows);

    // The single most recent year with the widest state coverage across all
    // three series — a cross-state snapshot needs one shared year, unlike
    // the "each state's own latest year" approach used for single-metric
    // ratios elsewhere in this dashboard.
    const candidatePeriods = Array.from(new Set(gsdpRows.map((r) => r.period))).sort().reverse();
    let bestPeriod = '';
    let bestCount = 0;
    candidatePeriods.forEach((period) => {
      const gsdpMap = gsdpByPeriod.get(period);
      const gfdMap = gfdByPeriod.get(period);
      const liabilitiesMap = liabilitiesByPeriod.get(period);
      if (!gsdpMap || !gfdMap || !liabilitiesMap) return;
      let count = 0;
      gsdpMap.forEach((gsdpValue, id) => {
        if (gsdpValue > 0 && gfdMap.has(id) && liabilitiesMap.has(id)) count += 1;
      });
      if (count > bestCount) {
        bestCount = count;
        bestPeriod = period;
      }
    });

    if (!bestPeriod) return { points: [] as StressPoint[], year: '', radiusFor: (_: number) => RADIUS_RANGE[0] };

    const gsdpMap = gsdpByPeriod.get(bestPeriod)!;
    const gfdMap = gfdByPeriod.get(bestPeriod)!;
    const liabilitiesMap = liabilitiesByPeriod.get(bestPeriod)!;
    const namesById = new Map<number, string>();
    gsdpRows.forEach((r) => namesById.set(r.dimension_id, r.dimension_name));

    const raw: StressPoint[] = [];
    gsdpMap.forEach((gsdpValue, id) => {
      if (gsdpValue <= 0) return;
      const gfdValue = gfdMap.get(id);
      const liabilitiesValue = liabilitiesMap.get(id);
      if (gfdValue == null || liabilitiesValue == null) return;
      const name = namesById.get(id);
      if (!name) return;
      const region = REGION_MAP[name] ?? null;
      raw.push({
        dimensionId: id,
        state: name,
        region,
        debtPct: (liabilitiesValue / gsdpValue) * 100,
        deficitPct: (gfdValue / gsdpValue) * 100,
        scale: gsdpValue,
        color: region ? regionColors[region] : colors.muted,
        selected: false,
      });
    });

    const scales = raw.map((p) => p.scale);
    const domain: [number, number] = [Math.min(...scales), Math.max(...scales)];
    const radiusForFn = (scale: number) => {
      if (domain[1] === domain[0]) return (RADIUS_RANGE[0] + RADIUS_RANGE[1]) / 2;
      const t = (scale - domain[0]) / (domain[1] - domain[0]);
      return RADIUS_RANGE[0] + t * (RADIUS_RANGE[1] - RADIUS_RANGE[0]);
    };

    return { points: raw, year: bestPeriod, radiusFor: radiusForFn };
  }, [gfdRows, liabilitiesRows, gsdpRows, regionColors, colors.muted]);

  const pointsWithSelection = useMemo(
    () => points.map((p) => ({ ...p, selected: compared.includes(p.state) })),
    [points, compared]
  );

  const allStates = useMemo(
    () => Array.from(new Set(points.map((p) => p.state))).sort((a, b) => a.localeCompare(b)),
    [points]
  );

  const filteredStates = useMemo(
    () => allStates.filter((name) => name.toLowerCase().includes(search.trim().toLowerCase())),
    [allStates, search]
  );

  const toggleCompared = (name: string) => {
    setCompared((prev) => (prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]));
  };

  return (
    <div className="fiscal-stress-map">
      <h3 className="fiscal-stress-map-title">7 · Fiscal Stress Map</h3>
      <p className="fiscal-stress-map-desc">
        Every state plotted by debt burden and deficit burden at once — both relative to the size of its
        economy. Bubble size is economic scale; colour is region.
      </p>

      <div className="fiscal-stress-map-control-group">
        <div className="fiscal-stress-map-control-header">
          <span className="fiscal-stress-map-control-label">Compare States (optional)</span>
          {compared.length > 0 && (
            <button type="button" className="fiscal-stress-map-clear-all-link" onClick={() => setCompared([])}>
              clear all
            </button>
          )}
        </div>
        <input
          type="text"
          className="fiscal-stress-map-state-search-input"
          placeholder="Type to filter…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="fiscal-stress-map-state-pill-grid">
          {filteredStates.map((name) => {
            const isSelected = compared.includes(name);
            return (
              <button
                key={name}
                type="button"
                className={`fiscal-stress-map-state-pill${isSelected ? ' selected' : ''}`}
                onClick={() => toggleCompared(name)}
              >
                {name}
              </button>
            );
          })}
          {!loading && filteredStates.length === 0 && (
            <span className="fiscal-stress-map-state-pill-empty">No states match "{search}".</span>
          )}
        </div>
      </div>

      {error && <div className="fiscal-stress-map-error">{error}</div>}

      {!error && (loading || pointsWithSelection.length === 0) && (
        <div className="fiscal-stress-map-empty">
          {loading ? 'Loading fiscal stress map…' : 'Not enough data to plot.'}
        </div>
      )}

      {!error && !loading && pointsWithSelection.length > 0 && (
        <>
          <div className="fiscal-stress-map-chart-wrap">
            <span className="fiscal-stress-map-axis-caption-y">Gross fiscal deficit, % of GSDP ({year})</span>
            <ExpandableChart title="7 · Fiscal Stress Map" height={380}>
              {(h) => (
                <ResponsiveContainer width="100%" height={h}>
                  <ScatterChart margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid stroke={colors.grid} />
                    <XAxis
                      type="number"
                      dataKey="debtPct"
                      name="Outstanding debt"
                      tick={{ fontSize: 12, fill: colors.axisText }}
                      axisLine={{ stroke: colors.grid }}
                      tickLine={false}
                      tickFormatter={(v: number) => pct(v)}
                    />
                    <YAxis
                      type="number"
                      dataKey="deficitPct"
                      name="Gross fiscal deficit"
                      tick={{ fontSize: 12, fill: colors.axisText }}
                      axisLine={{ stroke: colors.grid }}
                      tickLine={false}
                      tickFormatter={(v: number) => pct(v)}
                      width={48}
                    />
                    <Tooltip
                      content={(props) => <StressMapTooltip {...props} />}
                      cursor={{ strokeDasharray: '3 3' }}
                    />
                    <Legend verticalAlign="bottom" content={(props) => <StressMapLegend {...props} />} />
                    <ReferenceLine
                      x={STRESS_DEBT_THRESHOLD}
                      stroke={colors.muted}
                      strokeDasharray="4 4"
                      label={{
                        value: `${STRESS_DEBT_THRESHOLD}% debt/GSDP`,
                        position: 'insideTopRight',
                        fill: colors.axisText,
                        fontSize: 11,
                      }}
                    />
                    <ReferenceLine
                      y={FISCAL_DEFICIT_GSDP_LIMIT}
                      stroke={colors.muted}
                      strokeDasharray="4 4"
                      label={{
                        value: `FRBM ${FISCAL_DEFICIT_GSDP_LIMIT}% ceiling`,
                        position: 'insideBottomLeft',
                        fill: colors.axisText,
                        fontSize: 11,
                      }}
                    />
                    {REGION_ORDER.map((region) => (
                      <Scatter
                        key={region}
                        name={region}
                        data={pointsWithSelection.filter((p) => p.region === region)}
                        fill={regionColors[region]}
                        shape={(props: any) => <BubbleShape {...props} radiusFor={radiusFor} />}
                      />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </ExpandableChart>
            <span className="fiscal-stress-map-axis-caption-x">Outstanding debt, % of GSDP ({year})</span>
          </div>
          <div className="fiscal-stress-map-footnote">
            Dashed lines mark illustrative stress thresholds: {STRESS_DEBT_THRESHOLD}% debt/GSDP and the FRBM
            Act's {FISCAL_DEFICIT_GSDP_LIMIT}% deficit/GSDP ceiling. {year} is the most recent year with the
            widest state coverage across debt, deficit and GSDP data.{' '}
            {compared.length > 0 ? 'Gold-outlined bubbles are your compared states.' : ''}
          </div>
        </>
      )}
    </div>
  );
};

const BubbleShape: React.FC<any> = ({ cx, cy, payload, radiusFor }) => {
  const point = payload as StressPoint;
  const r = radiusFor(point.scale);
  return (
    <g>
      {point.selected && (
        <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke={GOLD_HIGHLIGHT} strokeWidth={3} />
      )}
      <circle cx={cx} cy={cy} r={r} fill={point.color} fillOpacity={0.72} stroke={point.color} strokeWidth={1} />
    </g>
  );
};

const StressMapTooltip: React.FC<TooltipContentProps> = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0]?.payload as StressPoint | undefined;
  if (!point) return null;
  return (
    <div className="fiscal-stress-map-tooltip">
      <span className="fiscal-stress-map-tooltip-key" style={{ background: point.color }} />
      <span className="fiscal-stress-map-tooltip-text">
        <strong>{point.state}</strong>: {pct(point.debtPct)} debt/GSDP, {pct(point.deficitPct)} deficit/GSDP
        {point.region ? ` · ${point.region}` : ''} · GSDP {formatInrShort(point.scale)}
      </span>
    </div>
  );
};

const StressMapLegend: React.FC<DefaultLegendContentProps> = ({ payload }) => {
  if (!payload) return null;
  return (
    <div className="fiscal-stress-map-legend">
      {payload.map((entry) => (
        <span className="fiscal-stress-map-legend-item" key={String(entry.value)}>
          <span className="fiscal-stress-map-legend-dot" style={{ background: entry.color }} />
          {entry.value}
        </span>
      ))}
    </div>
  );
};

export default FiscalStressMapChart;
