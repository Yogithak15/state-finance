import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchFiscalKeyMetrics,
  FISCAL_DEFICIT_GSDP_LIMIT,
  INTEREST_REVENUE_WATCH_LOW,
  INTEREST_REVENUE_WATCH_HIGH,
} from '../../api/fiscalApi';
import { formatInrShort } from '../../utils/format';
import './FiscalKeyMetrics.css';

interface FiscalMetrics {
  availableStates: string[];
  statesTracked: number;
  fiscalDeficitGsdp: { period: string; ratio: number } | null;
  debtGsdp: { period: string; ratio: number } | null;
  interestRevenue: { period: string; ratio: number } | null;
  revenueDeficit: { period: string; value: number } | null;
  gsdpGrowth: { period: string; avg: number } | null;
  peerDebtGsdpAvg: number | null;
  nationalGsdpGrowthAvg: number | null;
}

type Tone = 'good' | 'warn' | 'bad';

const pct = (v: number) => `${v.toFixed(1)}%`;

const FiscalKeyMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<FiscalMetrics | null>(null);
  const [selectedState, setSelectedState] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statesLoaded, setStatesLoaded] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchFiscalKeyMetrics(selectedState)
      .then((data: FiscalMetrics) => {
        if (cancelled) return;
        setMetrics(data);
        setStatesLoaded(data.availableStates);
        setSelectedState((prev) => {
          if (prev && data.availableStates.includes(prev)) return prev;
          return data.availableStates.includes('Karnataka') ? 'Karnataka' : data.availableStates[0] ?? '';
        });
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load fiscal key metrics.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch whenever the selected state changes (ratios/averages are
    // recomputed server-side... actually client-side, but keyed to state).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedState]);

  const latestYear = useMemo(
    () =>
      metrics?.fiscalDeficitGsdp?.period ??
      metrics?.debtGsdp?.period ??
      metrics?.revenueDeficit?.period ??
      null,
    [metrics]
  );

  if (error) {
    return <div className="fiscal-key-metrics-error">{error}</div>;
  }

  const fdGsdp = metrics?.fiscalDeficitGsdp?.ratio ?? null;
  const debtGsdp = metrics?.debtGsdp?.ratio ?? null;
  const intRev = metrics?.interestRevenue?.ratio ?? null;
  const revDeficit = metrics?.revenueDeficit?.value ?? null;
  const growth = metrics?.gsdpGrowth?.avg ?? null;
  const peerDebtAvg = metrics?.peerDebtGsdpAvg ?? null;
  const nationalGrowthAvg = metrics?.nationalGsdpGrowthAvg ?? null;

  const fdTone: Tone | null = fdGsdp == null ? null : fdGsdp <= FISCAL_DEFICIT_GSDP_LIMIT ? 'good' : 'bad';
  const debtTone: Tone | null =
    debtGsdp == null || peerDebtAvg == null ? null : debtGsdp <= peerDebtAvg ? 'good' : 'warn';
  const intTone: Tone | null =
    intRev == null
      ? null
      : intRev < INTEREST_REVENUE_WATCH_LOW
      ? 'good'
      : intRev <= INTEREST_REVENUE_WATCH_HIGH
      ? 'warn'
      : 'bad';
  const revDeficitTone: Tone | null = revDeficit == null ? null : revDeficit > 0 ? 'bad' : 'good';
  const growthTone: Tone | null =
    growth == null || nationalGrowthAvg == null ? null : growth > nationalGrowthAvg ? 'good' : 'warn';

  const cards = [
    {
      label: 'Fiscal Deficit / GSDP',
      pill: `RBI limit: ${FISCAL_DEFICIT_GSDP_LIMIT}%`,
      value: fdGsdp != null ? pct(fdGsdp) : '—',
      tone: fdTone,
      hint: fdTone === 'good' ? `Below RBI ${FISCAL_DEFICIT_GSDP_LIMIT}% ceiling` : fdTone === 'bad' ? `Exceeds RBI ${FISCAL_DEFICIT_GSDP_LIMIT}% ceiling` : 'Loading…',
    },
    {
      label: 'Debt / GSDP',
      pill: peerDebtAvg != null ? `Peer avg: ${pct(peerDebtAvg)}` : '',
      value: debtGsdp != null ? pct(debtGsdp) : '—',
      tone: debtTone,
      hint: peerDebtAvg != null ? `Peer average is ${pct(peerDebtAvg)} across states/UTs` : 'Loading…',
    },
    {
      label: 'Interest / Revenue',
      pill: `Watch: >${INTEREST_REVENUE_WATCH_HIGH}%`,
      value: intRev != null ? pct(intRev) : '—',
      tone: intTone,
      hint:
        intTone === 'good'
          ? 'Well within safe range'
          : intTone === 'warn'
          ? `Approaching ${INTEREST_REVENUE_WATCH_HIGH}% threshold`
          : intTone === 'bad'
          ? `Above ${INTEREST_REVENUE_WATCH_HIGH}% — debt servicing strain`
          : 'Loading…',
    },
    {
      label: 'Revenue Deficit',
      pill: '',
      value: revDeficit != null ? formatInrShort(revDeficit) : '—',
      tone: revDeficitTone,
      hint:
        revDeficitTone === 'bad'
          ? 'Borrowing to fund day-to-day spending'
          : revDeficitTone === 'good'
          ? 'Revenue receipts cover day-to-day spending'
          : 'Loading…',
    },
    {
      label: 'GSDP Growth (5Y avg)',
      pill: nationalGrowthAvg != null ? `National avg: ${pct(nationalGrowthAvg)}` : '',
      value: growth != null ? pct(growth) : '—',
      tone: growthTone,
      hint: nationalGrowthAvg != null ? `National avg ${pct(nationalGrowthAvg)}` : 'Loading…',
    },
  ];

  return (
    <div className="fiscal-key-metrics">
      <div className="fiscal-key-metrics-header">
        <span className="fiscal-key-metrics-title">◆ Fiscal Health — 5 Key Metrics</span>
        <div className="fiscal-key-metrics-state">
          <span className="fiscal-key-metrics-state-label">State</span>
          <select
            className="fiscal-key-metrics-state-select"
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
          >
            {statesLoaded.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="fiscal-key-metrics-grid">
        {cards.map((card) => (
          <div className="fiscal-key-metric-card" key={card.label}>
            <div className="fiscal-key-metric-top">
              <span className="fiscal-key-metric-label">{card.label}</span>
              {card.pill && <span className="fiscal-key-metric-pill">{card.pill}</span>}
            </div>
            <div className="fiscal-key-metric-value">{loading ? '—' : card.value}</div>
            <div className="fiscal-key-metric-hint">
              <span className={`fiscal-key-metric-dot${card.tone ? ` tone-${card.tone}` : ''}`} />
              {loading ? 'Loading…' : card.hint}
            </div>
          </div>
        ))}
      </div>

      <div className="fiscal-key-metrics-footnote">
        Figures use the latest fiscal year with complete data for the selected state{latestYear ? ` (${latestYear})` : ''}
        ; ratios are computed against GSDP for the matching year. Peer and national averages are computed
        across all {metrics?.statesTracked ?? '—'} tracked states/UTs, each using its own latest available
        year.
      </div>
    </div>
  );
};

export default FiscalKeyMetrics;
