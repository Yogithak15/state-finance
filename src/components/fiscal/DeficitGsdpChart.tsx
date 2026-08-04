import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  TooltipContentProps,
} from 'recharts';
import { fetchFiscalFinancialYearSeries, FISCAL_METRICS, FISCAL_DEFICIT_GSDP_LIMIT } from '../../api/fiscalApi';
import { fetchSdpFinancialYearSeries, SDP_METRICS } from '../../api/stateDomesticProductApi';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import { SearchIcon } from '../icons';
import { ExpandableChart } from '../ExpandableChart';
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const hasSetDefaultRef = useRef(false);
  const pickerRef = useRef<HTMLDivElement>(null);

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

  const availableStates = useMemo(
    () => allStates.filter((name) => !selected.includes(name)),
    [allStates, selected]
  );

  const filteredAvailableStates = useMemo(
    () => availableStates.filter((name) => name.toLowerCase().includes(search.trim().toLowerCase())),
    [availableStates, search]
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

  const addState = (name: string) => {
    toggleState(name);
    setSearch('');
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

      <div className="deficit-gsdp-controls">
        <div className="deficit-gsdp-measure-toggle" role="radiogroup" aria-label="Measure">
          {(['gross', 'revenue'] as Measure[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={measure === m}
              className={`deficit-gsdp-measure-option${measure === m ? ' active' : ''}`}
              onClick={() => setMeasure(m)}
            >
              {m === 'gross' ? 'Gross Fiscal Deficit' : 'Revenue Deficit'}
            </button>
          ))}
        </div>

        <div className="deficit-gsdp-state-picker" ref={pickerRef}>
          <div className="deficit-gsdp-state-input-wrap">
            <SearchIcon width={14} height={14} className="deficit-gsdp-search-icon" />
            <input
              type="text"
              className="deficit-gsdp-state-input"
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
            <div className="deficit-gsdp-state-dropdown">
              {filteredAvailableStates.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="deficit-gsdp-state-option"
                  onClick={() => addState(name)}
                >
                  {name}
                </button>
              ))}
              {filteredAvailableStates.length === 0 && (
                <span className="deficit-gsdp-state-dropdown-empty">
                  {availableStates.length === 0 ? 'All states added.' : `No states match “${search}”.`}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="deficit-gsdp-chips-row">
          {selected.map((name) => (
            <span key={name} className="deficit-gsdp-chip" style={{ background: colorMap[name] }}>
              {name}
              <button
                type="button"
                className="deficit-gsdp-chip-remove"
                onClick={() => toggleState(name)}
                aria-label={`Remove ${name}`}
              >
                ×
              </button>
            </span>
          ))}
          <button type="button" className="deficit-gsdp-clear-all-link" onClick={clearAll}>
            clear all
          </button>
        </div>
      )}

      {error && <div className="deficit-gsdp-error">{error}</div>}

      {!error && selected.length === 0 && (
        <div className="deficit-gsdp-empty">
          {loading ? 'Loading states…' : 'Add a state above to see its ratio trend.'}
        </div>
      )}

      {!error && selected.length > 0 && (
        <>
          <ExpandableChart
            title="2 · Deficit as a Share of the Economy"
            height={380}
            className="deficit-gsdp-chart"
          >
            {(h) => (
              <ResponsiveContainer width="100%" height={h}>
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke={colors.grid} />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 11, fill: colors.axisText }}
                    axisLine={{ stroke: colors.grid }}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={16}
                  />
                  <YAxis
                    tick={(props: { y?: number | string; payload?: { value: number } }) => (
                      <LeftAlignedYAxisTick {...props} fill={colors.axisText} />
                    )}
                    axisLine={{ stroke: colors.grid }}
                    tickLine={false}
                    tickFormatter={(v: number) => pct(v)}
                    width={40}
                  />
                  <Tooltip
                    content={(props) => <DeficitGsdpTooltip {...props} />}
                    cursor={{ stroke: colors.axisText, strokeDasharray: '3 3' }}
                  />
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
            )}
          </ExpandableChart>
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

// Left-aligned so every value starts flush at the card's left edge instead of
// recharts' default right-aligned ticks, which ragged-left differently-lengthed values.
const LeftAlignedYAxisTick: React.FC<{ y?: number | string; payload?: { value: number }; fill: string }> = ({
  y,
  payload,
  fill,
}) => (
  <text x={4} y={y} dy={4} fontSize={11} fill={fill} textAnchor="start">
    {pct(payload?.value ?? 0)}
  </text>
);

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

export default DeficitGsdpChart;
