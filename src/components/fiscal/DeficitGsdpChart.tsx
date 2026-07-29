import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  TooltipContentProps,
  DefaultLegendContentProps,
} from 'recharts';
import { fetchFiscalFinancialYearSeries, FISCAL_METRICS, FISCAL_DEFICIT_GSDP_LIMIT } from '../../api/fiscalApi';
import { fetchSdpFinancialYearSeries, SDP_METRICS } from '../../api/stateDomesticProductApi';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import './DeficitGsdpChart.css';

interface MetricRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

type Measure = 'gross' | 'revenue';

const MEASURE_METRIC: Record<Measure, number> = {
  gross: FISCAL_METRICS.grossFiscalDeficit,
  revenue: FISCAL_METRICS.revenueDeficit,
};

const pct = (v: number) => `${v.toFixed(1)}%`;

const DeficitGsdpChart: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const PALETTE = colors.categorical;
  const [measure, setMeasure] = useState<Measure>('gross');
  const [deficitRows, setDeficitRows] = useState<MetricRow[]>([]);
  const [gsdpRows, setGsdpRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const hasSetDefaultRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchFiscalFinancialYearSeries(MEASURE_METRIC[measure]),
      fetchSdpFinancialYearSeries(SDP_METRICS.gsdpCurrent),
    ])
      .then(([deficit, gsdp]: [MetricRow[], MetricRow[]]) => {
        if (cancelled) return;
        setDeficitRows(deficit);
        setGsdpRows(gsdp);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load deficit ÷ GSDP data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [measure]);

  // Ratio per state/year — only for years where both the fiscal metric and
  // GSDP have data. GSDP (State Domestic Product) only goes back to 2011-12,
  // even though the fiscal series itself starts earlier, so the ratio series
  // is naturally shorter than either underlying series.
  const { ratioRows, yearRange } = useMemo(() => {
    const gsdpByState = new Map<number, Map<string, number>>();
    gsdpRows.forEach((r) => {
      if (!gsdpByState.has(r.dimension_id)) gsdpByState.set(r.dimension_id, new Map());
      gsdpByState.get(r.dimension_id)!.set(r.period, r.value);
    });

    const rows: MetricRow[] = [];
    deficitRows.forEach((r) => {
      const gsdp = gsdpByState.get(r.dimension_id)?.get(r.period);
      if (!gsdp) return;
      rows.push({ ...r, value: (r.value / gsdp) * 100 });
    });

    const periods = Array.from(new Set(rows.map((r) => r.period))).sort();
    return { ratioRows: rows, yearRange: { start: periods[0] ?? '', end: periods[periods.length - 1] ?? '' } };
  }, [deficitRows, gsdpRows]);

  const allStates = useMemo(
    () => Array.from(new Set(ratioRows.map((r) => r.dimension_name))).sort((a, b) => a.localeCompare(b)),
    [ratioRows]
  );

  const filteredStates = useMemo(
    () => allStates.filter((name) => name.toLowerCase().includes(search.trim().toLowerCase())),
    [allStates, search]
  );

  useEffect(() => {
    if (hasSetDefaultRef.current || ratioRows.length === 0) return;
    const latestPeriod = ratioRows.reduce((max, r) => (r.period > max ? r.period : max), '');
    const latestRows = ratioRows.filter((r) => r.period === latestPeriod).sort((a, b) => b.value - a.value);
    if (latestRows.length === 0) return;

    const highest = latestRows[0];
    const lowest = latestRows[latestRows.length - 1];
    const median = latestRows[Math.floor(latestRows.length / 2)];
    const defaultNames = Array.from(new Set([highest, median, lowest].map((r) => r.dimension_name)));

    setSelected(defaultNames);
    setColorMap((cm) => {
      const next = { ...cm };
      defaultNames.forEach((name, i) => {
        next[name] = PALETTE[i % PALETTE.length];
      });
      return next;
    });
    hasSetDefaultRef.current = true;
  }, [ratioRows, PALETTE]);

  const chartData = useMemo(() => {
    const byPeriod = new Map<string, Record<string, number | string>>();
    ratioRows.forEach((r) => {
      if (!selected.includes(r.dimension_name)) return;
      if (!byPeriod.has(r.period)) byPeriod.set(r.period, { period: r.period });
      (byPeriod.get(r.period) as Record<string, number | string>)[r.dimension_name] = r.value;
    });
    return Array.from(byPeriod.values()).sort((a, b) => String(a.period).localeCompare(String(b.period)));
  }, [ratioRows, selected]);

  const toggleState = (name: string) => {
    setSelected((prev) => {
      if (prev.includes(name)) {
        setColorMap((cm) => {
          const next = { ...cm };
          delete next[name];
          return next;
        });
        return prev.filter((s) => s !== name);
      }
      setColorMap((cm) => {
        const used = new Set(Object.values(cm));
        const color = PALETTE.find((c) => !used.has(c)) ?? PALETTE[prev.length % PALETTE.length];
        return { ...cm, [name]: color };
      });
      return [...prev, name];
    });
  };

  const clearAll = () => {
    setSelected([]);
    setColorMap({});
  };

  const refLineValue = measure === 'gross' ? FISCAL_DEFICIT_GSDP_LIMIT : 0;
  const refLineLabel = measure === 'gross' ? `FRBM ${FISCAL_DEFICIT_GSDP_LIMIT}% ceiling` : 'Revenue deficit target: 0%';

  return (
    <div className="deficit-gsdp">
      <h3 className="deficit-gsdp-title">2 · Deficit as a Share of the Economy</h3>
      <p className="deficit-gsdp-desc">
        Raw rupee deficits aren't comparable across states of very different sizes. Dividing by each
        state's own GSDP gives the ratio budget-watchers actually track against the FRBM Act's{' '}
        {FISCAL_DEFICIT_GSDP_LIMIT}% ceiling.
      </p>

      <div className="deficit-gsdp-control-group">
        <span className="deficit-gsdp-control-label">Measure</span>
        <div className="deficit-gsdp-measure-toggle" role="radiogroup">
          {(['gross', 'revenue'] as Measure[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={measure === m}
              className={`deficit-gsdp-measure-option${measure === m ? ' active' : ''}`}
              onClick={() => setMeasure(m)}
            >
              <span className="deficit-gsdp-measure-dot" />
              {m === 'gross' ? 'Gross Fiscal Deficit' : 'Revenue Deficit'}
            </button>
          ))}
        </div>
      </div>

      <div className="deficit-gsdp-control-group">
        <div className="deficit-gsdp-control-header">
          <span className="deficit-gsdp-control-label">Search States</span>
          {selected.length > 0 && (
            <button type="button" className="deficit-gsdp-clear-all-link" onClick={clearAll}>
              clear all
            </button>
          )}
        </div>
        <input
          type="text"
          className="deficit-gsdp-state-search-input"
          placeholder="Type to filter…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="deficit-gsdp-state-pill-grid">
          {filteredStates.map((name) => {
            const isSelected = selected.includes(name);
            return (
              <button
                key={name}
                type="button"
                className={`deficit-gsdp-state-pill${isSelected ? ' selected' : ''}`}
                style={isSelected ? { background: colorMap[name], borderColor: colorMap[name] } : undefined}
                onClick={() => toggleState(name)}
              >
                {name}
              </button>
            );
          })}
          {!loading && filteredStates.length === 0 && (
            <span className="deficit-gsdp-state-pill-empty">No states match “{search}”.</span>
          )}
        </div>
      </div>

      {error && <div className="deficit-gsdp-error">{error}</div>}

      {!error && selected.length === 0 && (
        <div className="deficit-gsdp-empty">
          {loading ? 'Loading states…' : 'Select one or more states above to see their ratio trend.'}
        </div>
      )}

      {!error && selected.length > 0 && (
        <>
          <div className="deficit-gsdp-chart">
            <ResponsiveContainer width="100%" height={380}>
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
                  tickFormatter={(v: number) => pct(v)}
                  width={48}
                />
                <Tooltip content={(props) => <DeficitGsdpTooltip {...props} />} />
                <Legend content={(props) => <DeficitGsdpLegend {...props} />} />
                <ReferenceLine
                  y={refLineValue}
                  stroke={colors.categorical[5]}
                  strokeDasharray="6 4"
                  label={{ value: refLineLabel, position: 'insideBottomLeft', fill: colors.categorical[5], fontSize: 11 }}
                />
                {selected.map((name) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={colorMap[name]}
                    strokeWidth={2}
                    dot={{ r: 3, fill: colorMap[name], stroke: colors.surface, strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: colorMap[name], stroke: colors.surface, strokeWidth: 2 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="deficit-gsdp-footnote">
            {measure === 'gross'
              ? `Dashed line marks the FRBM Act's ${FISCAL_DEFICIT_GSDP_LIMIT}%-of-GSDP gross fiscal deficit benchmark.`
              : 'Dashed line marks zero — the conventional target of eliminating the revenue deficit entirely.'}{' '}
            Ratio computed only for {yearRange.start} to {yearRange.end}, where GSDP data is available.
          </div>
        </>
      )}
    </div>
  );
};

const DeficitGsdpTooltip: React.FC<TooltipContentProps> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const sorted = [...payload].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  return (
    <div className="deficit-gsdp-tooltip">
      <div className="deficit-gsdp-tooltip-period">{label}</div>
      {sorted.map((entry) => (
        <div className="deficit-gsdp-tooltip-row" key={String(entry.dataKey)}>
          <span className="deficit-gsdp-tooltip-key" style={{ background: entry.color }} />
          <span className="deficit-gsdp-tooltip-value">{pct(Number(entry.value))}</span>
          <span className="deficit-gsdp-tooltip-name">{String(entry.dataKey)}</span>
        </div>
      ))}
    </div>
  );
};

const DeficitGsdpLegend: React.FC<DefaultLegendContentProps> = ({ payload }) => {
  if (!payload) return null;
  return (
    <div className="deficit-gsdp-legend">
      {payload
        .filter((entry) => typeof entry.dataKey === 'string')
        .map((entry) => (
          <span className="deficit-gsdp-legend-item" key={String(entry.dataKey)}>
            <span className="deficit-gsdp-legend-dot" style={{ background: entry.color }} />
            {entry.value}
          </span>
        ))}
    </div>
  );
};

export default DeficitGsdpChart;
