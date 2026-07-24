import React, { useEffect, useMemo, useState } from 'react';
import { fetchPwFinancialYearSeries, PW_METRICS } from '../../api/priceWagesApi';
import { RBI_TARGET_CENTER } from '../../utils/bandColor';
import { divergingColor, textColorForBg } from '../../utils/divergingColor';
import { useTheme } from '../../theme/ThemeContext';
import './PwInflationHeatmapChart.css';

interface MetricRow {
  period: string;
  value: number;
  dimension_id: number;
  dimension_name: string;
}

type SortMode = 'latest' | 'avg' | 'alpha';

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'latest', label: 'Latest year (highest first)' },
  { id: 'avg', label: 'Average inflation (highest first)' },
  { id: 'alpha', label: 'State name (A–Z)' },
];

interface StateInflationRow {
  dimensionId: number;
  state: string;
  values: Map<string, number>;
}

const PwInflationHeatmapChart: React.FC = () => {
  const { theme } = useTheme();
  const [sortMode, setSortMode] = useState<SortMode>('latest');
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
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load inflation heatmap data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { stateRows, periods, maxAbsDeviation } = useMemo(() => {
    const byState = new Map<number, { name: string; rows: MetricRow[] }>();
    rows.forEach((r) => {
      if (!byState.has(r.dimension_id)) byState.set(r.dimension_id, { name: r.dimension_name, rows: [] });
      byState.get(r.dimension_id)!.rows.push(r);
    });

    const allPeriods = Array.from(new Set(rows.map((r) => r.period))).sort();

    let maxAbsValue = 0;
    const result: StateInflationRow[] = [];
    byState.forEach((entry, dimensionId) => {
      const values = new Map<string, number>();
      entry.rows.forEach((r) => {
        values.set(r.period, r.value);
        maxAbsValue = Math.max(maxAbsValue, Math.abs(r.value - RBI_TARGET_CENTER));
      });
      result.push({ dimensionId, state: entry.name, values });
    });

    return { stateRows: result, periods: allPeriods, maxAbsDeviation: maxAbsValue };
  }, [rows]);

  const sortedRows = useMemo(() => {
    const latestPeriod = periods[periods.length - 1];
    const metricFor = (row: StateInflationRow) => {
      if (sortMode === 'latest') return row.values.get(latestPeriod);
      if (sortMode === 'avg') {
        const values = Array.from(row.values.values());
        return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : undefined;
      }
      return undefined;
    };

    const copy = [...stateRows];
    if (sortMode === 'alpha') {
      copy.sort((a, b) => a.state.localeCompare(b.state));
    } else {
      copy.sort((a, b) => {
        const av = metricFor(a);
        const bv = metricFor(b);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return bv - av;
      });
    }
    return copy;
  }, [stateRows, sortMode, periods]);

  return (
    <div className="pw-heatmap">
      <h3 className="pw-heatmap-title">3 · Inflation Heatmap</h3>
      <p className="pw-heatmap-desc">
        A state × year grid colour-coded against the RBI's {RBI_TARGET_CENTER}% inflation target: green
        marks years at or below target, red marks years running hot above it — the same colour language
        used for the Growth Shock Heatmap — so columns with widespread shocks jump out immediately.
      </p>

      <div className="pw-heatmap-controls">
        <div className="pw-control">
          <span className="pw-control-label">Sort By</span>
          <select
            className="pw-control-select"
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

      {error && <div className="pw-heatmap-error">{error}</div>}

      {!error && (loading || sortedRows.length === 0) && (
        <div className="pw-heatmap-empty">
          {loading ? 'Loading inflation heatmap…' : 'Not enough data to build the heatmap.'}
        </div>
      )}

      {!error && !loading && sortedRows.length > 0 && (
        <div className="pw-heatmap-scroll">
          <table className="pw-heatmap-table">
            <thead>
              <tr>
                <th className="pw-heatmap-state-header">State / UT</th>
                {periods.map((p) => (
                  <th key={p}>{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.dimensionId}>
                  <td className="pw-heatmap-state-cell" title={row.state}>
                    {row.state}
                  </td>
                  {periods.map((p) => {
                    const value = row.values.get(p);
                    if (value == null) {
                      return <td key={p} className="pw-heatmap-cell pw-heatmap-cell-empty" />;
                    }
                    const bg = divergingColor(RBI_TARGET_CENTER - value, maxAbsDeviation, theme);
                    return (
                      <td
                        key={p}
                        className="pw-heatmap-cell"
                        style={{ background: bg, color: textColorForBg(bg) }}
                        title={`${row.state}, ${p}: ${value.toFixed(1)}%`}
                      >
                        {value.toFixed(1)}
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

export default PwInflationHeatmapChart;
