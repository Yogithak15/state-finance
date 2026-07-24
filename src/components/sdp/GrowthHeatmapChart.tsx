import React, { useEffect, useMemo, useState } from 'react';
import { fetchSdpFinancialYearSeries, SDP_METRICS } from '../../api/stateDomesticProductApi';
import { divergingColor, textColorForBg } from '../../utils/divergingColor';
import { useTheme } from '../../theme/ThemeContext';
import './GrowthHeatmapChart.css';

interface MetricRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

const METRIC_OPTIONS = [
  { id: SDP_METRICS.perCapitaConstant, label: 'Per-Capita NSDP (real)' },
  { id: SDP_METRICS.gsdpConstant, label: 'Gross SDP (real)' },
  { id: SDP_METRICS.nsdpConstant, label: 'Net SDP (real)' },
];

// Real-world Covid-contraction year — a fixed historical anchor, not fetched data.
const COVID_IMPACT_PERIOD = '2020-21';

type SortMode = 'covid' | 'alpha' | 'avg' | 'latest';

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'covid', label: `${COVID_IMPACT_PERIOD} Covid impact (worst first)` },
  { id: 'avg', label: 'Average growth (best first)' },
  { id: 'latest', label: 'Latest year growth (best first)' },
  { id: 'alpha', label: 'State name (A–Z)' },
];

interface StateGrowthRow {
  dimensionId: number;
  state: string;
  growth: Map<string, number>;
}

const GrowthHeatmapChart: React.FC = () => {
  const { theme } = useTheme();
  const [metricId, setMetricId] = useState<number>(SDP_METRICS.perCapitaConstant);
  const [sortMode, setSortMode] = useState<SortMode>('covid');
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSdpFinancialYearSeries(metricId)
      .then((data: MetricRow[]) => {
        if (cancelled) return;
        setRows(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load growth heatmap data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [metricId]);

  const { stateRows, growthPeriods, maxAbs } = useMemo(() => {
    const byState = new Map<number, { name: string; periods: MetricRow[] }>();
    rows.forEach((r) => {
      if (!byState.has(r.dimension_id)) byState.set(r.dimension_id, { name: r.dimension_name, periods: [] });
      byState.get(r.dimension_id)!.periods.push(r);
    });

    const allPeriods = Array.from(new Set(rows.map((r) => r.period))).sort();
    const periodsForGrowth = allPeriods.slice(1); // first period has no prior year to grow from

    let maxAbsValue = 0;
    const growthRows: StateGrowthRow[] = [];
    byState.forEach((entry, dimensionId) => {
      const periods = [...entry.periods].sort((a, b) => a.period.localeCompare(b.period));
      const growth = new Map<string, number>();
      for (let i = 1; i < periods.length; i += 1) {
        const prev = periods[i - 1];
        const curr = periods[i];
        if (prev.value <= 0) continue;
        const pct = ((curr.value - prev.value) / prev.value) * 100;
        growth.set(curr.period, pct);
        maxAbsValue = Math.max(maxAbsValue, Math.abs(pct));
      }
      growthRows.push({ dimensionId, state: entry.name, growth });
    });

    return { stateRows: growthRows, growthPeriods: periodsForGrowth, maxAbs: maxAbsValue };
  }, [rows]);

  const sortedRows = useMemo(() => {
    const withMetric = (row: StateGrowthRow) => {
      if (sortMode === 'covid') return row.growth.get(COVID_IMPACT_PERIOD);
      if (sortMode === 'latest') {
        const last = [...growthPeriods].reverse().find((p) => row.growth.has(p));
        return last ? row.growth.get(last) : undefined;
      }
      if (sortMode === 'avg') {
        const values = Array.from(row.growth.values());
        return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : undefined;
      }
      return undefined;
    };

    const copy = [...stateRows];
    if (sortMode === 'alpha') {
      copy.sort((a, b) => a.state.localeCompare(b.state));
    } else {
      copy.sort((a, b) => {
        const av = withMetric(a);
        const bv = withMetric(b);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return sortMode === 'covid' ? av - bv : bv - av;
      });
    }
    return copy;
  }, [stateRows, sortMode, growthPeriods]);

  return (
    <div className="growth-heatmap">
      <h3 className="growth-heatmap-title">6 · Growth Shock Heatmap</h3>
      <p className="growth-heatmap-desc">
        A colour-coded state × year grid of year-on-year real growth makes shared shocks jump out
        immediately — the {COVID_IMPACT_PERIOD} Covid contraction hits almost every row at once.
      </p>

      <div className="growth-heatmap-controls">
        <div className="control">
          <span className="control-label">Metric</span>
          <select
            className="control-select"
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

        <div className="control">
          <span className="control-label">Sort By</span>
          <select
            className="control-select"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="growth-heatmap-error">{error}</div>}

      {!error && (loading || sortedRows.length === 0) && (
        <div className="growth-heatmap-empty">
          {loading ? 'Loading growth heatmap…' : 'Not enough data to build the heatmap.'}
        </div>
      )}

      {!error && !loading && sortedRows.length > 0 && (
        <div className="growth-heatmap-scroll">
          <table className="growth-heatmap-table">
            <thead>
              <tr>
                <th className="growth-heatmap-state-header">State / UT</th>
                {growthPeriods.map((p) => (
                  <th key={p}>{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.dimensionId}>
                  <td className="growth-heatmap-state-cell" title={row.state}>
                    {row.state}
                  </td>
                  {growthPeriods.map((p) => {
                    const value = row.growth.get(p);
                    if (value == null) {
                      return <td key={p} className="growth-heatmap-cell growth-heatmap-cell-empty" />;
                    }
                    const bg = divergingColor(value, maxAbs, theme);
                    return (
                      <td
                        key={p}
                        className="growth-heatmap-cell"
                        style={{ background: bg, color: textColorForBg(bg) }}
                        title={`${row.state}, ${p}: ${value >= 0 ? '+' : ''}${value.toFixed(1)}%`}
                      >
                        {Math.round(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default GrowthHeatmapChart;
