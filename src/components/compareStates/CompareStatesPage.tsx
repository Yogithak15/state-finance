import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchCompareMetricSeries, COMPARE_METRIC_GROUPS, COMPARE_METRIC_MAP } from '../../api/compareApi';
import { formatInrShort } from '../../utils/format';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import { MetricRow, TrendChart, buildTrendDataByState } from '../stateProfile/profileWidgets';
import { SearchIcon } from '../icons';
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const userTouchedRef = useRef(false);
  const pickerRef = useRef<HTMLDivElement>(null);

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

  // Close the add-state dropdown on an outside click.
  useEffect(() => {
    if (!pickerOpen) return undefined;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pickerOpen]);

  const allStates = useMemo(
    () => Array.from(new Set(rows.map((r) => r.dimension_name))).sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  const availableStates = useMemo(
    () => allStates.filter((name) => !selected.includes(name)),
    [allStates, selected]
  );

  const filteredAvailableStates = useMemo(
    () => availableStates.filter((name) => name.toLowerCase().includes(search.trim().toLowerCase())),
    [availableStates, search]
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

  const addState = (name: string) => {
    toggleState(name);
    setSearch('');
  };

  const clearAll = () => {
    userTouchedRef.current = true;
    setSelected([]);
    setColorMap({});
  };

  const formatValue = (v: number) => formatByUnit(metric.unit, v);

  return (
    <div className="compare-states">
      <h3 className="compare-states-title">Compare States</h3>
      <p className="compare-states-desc">
        Compare any two or more states on any tracked metric, across all six RBI datasets.
      </p>

      <div className="compare-states-controls">
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

        <div className="compare-states-picker" ref={pickerRef}>
          <div className="compare-states-picker-input-wrap">
            <SearchIcon width={14} height={14} className="compare-states-search-icon" />
            <input
              type="text"
              className="compare-states-picker-input"
              placeholder="Add a state to compare…"
              value={search}
              onFocus={() => setPickerOpen(true)}
              onChange={(e) => {
                setSearch(e.target.value);
                setPickerOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredAvailableStates.length > 0) {
                  e.preventDefault();
                  addState(filteredAvailableStates[0]);
                }
              }}
            />
          </div>
          {pickerOpen && (
            <div className="compare-states-picker-dropdown">
              {filteredAvailableStates.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="compare-states-picker-option"
                  onClick={() => addState(name)}
                >
                  {name}
                </button>
              ))}
              {filteredAvailableStates.length === 0 && (
                <span className="compare-states-picker-empty">
                  {availableStates.length === 0 ? 'All states added.' : `No states match “${search}”.`}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="compare-states-chips-row">
          {selected.map((name) => (
            <span key={name} className="compare-states-chip" style={{ background: colorMap[name] }}>
              {name}
              <button
                type="button"
                className="compare-states-chip-remove"
                onClick={() => toggleState(name)}
                aria-label={`Remove ${name}`}
              >
                ×
              </button>
            </span>
          ))}
          <button type="button" className="compare-states-clear-all-link" onClick={clearAll}>
            clear all
          </button>
        </div>
      )}

      {error && <div className="compare-states-error">{error}</div>}

      {!error && selected.length === 0 && (
        <div className="compare-states-empty">
          {loading ? 'Loading states…' : 'Add two or more states above to compare their trend.'}
        </div>
      )}

      {!error && selected.length > 0 && (
        <div className="compare-states-chart">
          <TrendChart
            data={chartData}
            series={selected.map((name) => ({ key: name, label: name, color: colorMap[name] ?? colors.ink }))}
            yFormatter={formatValue}
            height={360}
            colors={colors}
            showLegend={false}
            title={`${metric.label} — state comparison`}
          />
        </div>
      )}
    </div>
  );
};

export default CompareStatesPage;
