import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchCompareMetricSeries, COMPARE_METRIC_GROUPS, COMPARE_METRIC_MAP } from '../../api/compareApi';
import { formatInrShort } from '../../utils/format';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import { MetricRow, TrendChart, buildTrendDataByState } from '../stateProfile/profileWidgets';
import './CompareStatesPage.css';

// ─────────────────────────────────────────────────────────────────────────────
//  Compare States — pick any one metric out of every RBI dataset tracked in
//  the dashboard, then compare it across any number of states: a multi-line
//  trend chart plus a head-to-head "latest value" stat row.
// ─────────────────────────────────────────────────────────────────────────────

type MetricUnit = 'amount' | 'percentage' | 'index' | 'number';

interface CompareMetric {
  key: string;
  metricId: number;
  label: string;
  unit: MetricUnit;
  groupLabel: string;
  sourceId: number;
}

const DEFAULT_METRIC_KEY = 'sdp_gsdp_current';

const formatByUnit = (unit: MetricUnit, v: number): string => {
  switch (unit) {
    case 'amount':
      return formatInrShort(v);
    case 'percentage':
      return `${v.toFixed(1)}%`;
    case 'index':
      return v.toFixed(2);
    case 'number':
    default:
      return Math.round(v).toString();
  }
};

const CompareStatesPage: React.FC = () => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];
  const PALETTE = colors.categorical;

  const [metricKey, setMetricKey] = useState<string>(DEFAULT_METRIC_KEY);
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  // Tracks whether the user has manually edited the state selection since the
  // last metric change — reset to false every time the metric changes, so
  // switching metrics always re-picks a sensible default pair unless the
  // user immediately touches the selector again for the new metric.
  const userTouchedRef = useRef(false);

  const metric = COMPARE_METRIC_MAP[metricKey] as CompareMetric;

  useEffect(() => {
    let cancelled = false;
    userTouchedRef.current = false;
    setLoading(true);
    setError(null);
    fetchCompareMetricSeries(metric.sourceId, metric.metricId)
      .then((data: MetricRow[]) => {
        if (cancelled) return;
        setRows(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(`Unable to load "${metric.label}".`);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricKey]);

  const allStates = useMemo(
    () => Array.from(new Set(rows.map((r) => r.dimension_name))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  const filteredStates = useMemo(
    () => allStates.filter((name) => name.toLowerCase().includes(search.trim().toLowerCase())),
    [allStates, search]
  );

  // Default selection: the highest- and lowest-ranked state at the latest
  // available period for the currently selected metric. Recomputed fresh
  // whenever new rows arrive for a metric, unless the user has already
  // hand-picked a selection for this metric.
  useEffect(() => {
    if (userTouchedRef.current || rows.length === 0) return;
    const latestPeriod = rows.reduce((max, r) => (r.period > max ? r.period : max), '');
    const latestRows = rows.filter((r) => r.period === latestPeriod).sort((a, b) => b.value - a.value);
    if (latestRows.length === 0) return;

    const highest = latestRows[0];
    const lowest = latestRows[latestRows.length - 1];
    const defaultNames = Array.from(new Set([highest, lowest].map((r) => r.dimension_name)));

    setSelected(defaultNames);
    setColorMap(() => {
      const next: Record<string, string> = {};
      defaultNames.forEach((name, i) => {
        next[name] = PALETTE[i % PALETTE.length];
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const chartData = useMemo(() => buildTrendDataByState(rows, selected), [rows, selected]);

  const toggleState = (name: string) => {
    userTouchedRef.current = true;
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
    userTouchedRef.current = true;
    setSelected([]);
    setColorMap({});
  };

  const formatValue = (v: number) => formatByUnit(metric.unit, v);

  // Head-to-head: each selected state's latest available value.
  const latestByState = useMemo(
    () =>
      selected.map((name) => {
        const stateRows = rows
          .filter((r) => r.dimension_name === name)
          .slice()
          .sort((a, b) => a.period.localeCompare(b.period));
        const last = stateRows[stateRows.length - 1];
        return { name, period: last?.period ?? null, value: last?.value ?? null };
      }),
    [rows, selected]
  );

  // Only meaningful for exactly 2 states — 3+ makes "which pair?" ambiguous.
  const diffTile = useMemo(() => {
    if (latestByState.length !== 2) return null;
    const [a, b] = latestByState;
    if (a.value == null || b.value == null) return null;
    const hi = Math.max(a.value, b.value);
    const lo = Math.min(a.value, b.value);
    return { diff: hi - lo, ratio: lo !== 0 ? hi / lo : null };
  }, [latestByState]);

  return (
    <div className="compare-states">
      <h3 className="compare-states-title">Compare States</h3>
      <p className="compare-states-desc">
        Compare any two or more states on any tracked metric, across all six RBI datasets.
      </p>

      <div className="compare-states-control-group">
        <span className="compare-states-control-label">Metric</span>
        <select
          className="compare-states-metric-select"
          value={metricKey}
          onChange={(e) => setMetricKey(e.target.value)}
        >
          {COMPARE_METRIC_GROUPS.map((g) => (
            <optgroup key={g.groupLabel} label={g.groupLabel}>
              {g.metrics.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="compare-states-control-group">
        <div className="compare-states-control-header">
          <span className="compare-states-control-label">Search States</span>
          {selected.length > 0 && (
            <button type="button" className="compare-states-clear-all-link" onClick={clearAll}>
              clear all
            </button>
          )}
        </div>
        <input
          type="text"
          className="compare-states-state-search-input"
          placeholder="Type to filter…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="compare-states-state-pill-grid">
          {filteredStates.map((name) => {
            const isSelected = selected.includes(name);
            return (
              <button
                key={name}
                type="button"
                className={`compare-states-state-pill${isSelected ? ' selected' : ''}`}
                style={isSelected ? { background: colorMap[name], borderColor: colorMap[name] } : undefined}
                onClick={() => toggleState(name)}
              >
                {name}
              </button>
            );
          })}
          {!loading && filteredStates.length === 0 && (
            <span className="compare-states-state-pill-empty">No states match “{search}”.</span>
          )}
        </div>
      </div>

      {error && <div className="compare-states-error">{error}</div>}

      {!error && selected.length === 0 && (
        <div className="compare-states-empty">
          {loading ? 'Loading states…' : 'Select two or more states above to compare their trend.'}
        </div>
      )}

      {!error && selected.length > 0 && (
        <>
          <div className="compare-states-chart">
            <TrendChart
              data={chartData}
              series={selected.map((name) => ({ key: name, label: name, color: colorMap[name] ?? colors.ink }))}
              yFormatter={formatValue}
              height={380}
              colors={colors}
            />
          </div>

          <div className="compare-states-stats">
            {latestByState.map((s) => (
              <div className="compare-states-stat-tile" key={s.name}>
                <span className="compare-states-stat-tile-head">
                  <span className="compare-states-stat-dot" style={{ background: colorMap[s.name] }} />
                  <span className="compare-states-stat-label">{s.name}</span>
                </span>
                <span className="compare-states-stat-value">{s.value != null ? formatValue(s.value) : '—'}</span>
                <span className="compare-states-stat-hint">{s.period ? `FY ${s.period}` : 'No data'}</span>
              </div>
            ))}
            {diffTile && (
              <div className="compare-states-stat-tile compare-states-stat-tile-diff">
                <span className="compare-states-stat-label">Difference</span>
                <span className="compare-states-stat-value">{formatValue(diffTile.diff)}</span>
                <span className="compare-states-stat-hint">
                  {diffTile.ratio != null ? `${diffTile.ratio.toFixed(1)}× ratio` : 'Ratio unavailable'}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CompareStatesPage;
