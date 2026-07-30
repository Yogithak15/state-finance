import React, { useEffect, useMemo, useState } from 'react';
import { fetchBankingFinancialYearSeries, BANKING_METRICS } from '../../api/bankingApi';
import { formatInrShort } from '../../utils/format';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import {
  MetricRow,
  SectionCard,
  ChartGrid,
  ChartBlock,
  StatTileRow,
  TrendChart,
  buildTrendData,
  latestForState,
  hasAnyValue,
  fetchMetricRows,
  pct1,
  intFmt,
} from './profileWidgets';

interface Props {
  state: string;
}

const BankingProfileSection: React.FC<Props> = ({ state }) => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];

  const [rows, setRows] = useState<Record<string, MetricRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchMetricRows(fetchBankingFinancialYearSeries, BANKING_METRICS)
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load Banking data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const depositsCreditData = useMemo(
    () => buildTrendData({ 'SCB deposits': rows.scbDeposits, 'SCB credit': rows.scbCredit }, state),
    [rows, state]
  );
  const cdRatioData = useMemo(
    () =>
      buildTrendData(
        {
          'SCB C-D ratio (sanction)': rows.scbCdRatioSanction,
          'SCB C-D ratio (utilisation)': rows.scbCdRatioUtilisation,
          'RRB C-D ratio': rows.rrbCdRatio,
        },
        state
      ),
    [rows, state]
  );
  const sectoralCreditData = useMemo(
    () =>
      buildTrendData(
        {
          Agriculture: rows.scbCreditAgriculture,
          Industry: rows.scbCreditIndustry,
          'Personal loans': rows.scbPersonalLoans,
        },
        state
      ),
    [rows, state]
  );
  const rrbData = useMemo(
    () => buildTrendData({ 'RRB deposits': rows.rrbDeposits, 'RRB credit': rows.rrbCredit }, state),
    [rows, state]
  );

  const scbOfficesLatest = latestForState(rows.scbOffices ?? [], state);
  const rrbBranchesLatest = latestForState(rows.rrbBranches ?? [], state);

  const empty =
    !loading &&
    !hasAnyValue(depositsCreditData, ['SCB deposits', 'SCB credit']) &&
    !hasAnyValue(cdRatioData, ['SCB C-D ratio (sanction)', 'SCB C-D ratio (utilisation)', 'RRB C-D ratio']) &&
    !hasAnyValue(sectoralCreditData, ['Agriculture', 'Industry', 'Personal loans']) &&
    !hasAnyValue(rrbData, ['RRB deposits', 'RRB credit']) &&
    !scbOfficesLatest &&
    !rrbBranchesLatest;

  return (
    <SectionCard
      title="3 · Banking"
      description="Deposits, credit, credit-deposit ratios, and branch network for scheduled commercial banks and regional rural banks."
      loading={loading}
      error={error}
      empty={empty}
      stateName={state}
    >
      <StatTileRow
        tiles={[
          {
            label: 'SCB Offices',
            value: scbOfficesLatest ? intFmt(scbOfficesLatest.value) : '—',
            hint: scbOfficesLatest ? `FY ${scbOfficesLatest.period}` : 'No data',
          },
          {
            label: 'RRB Branches',
            value: rrbBranchesLatest ? intFmt(rrbBranchesLatest.value) : '—',
            hint: rrbBranchesLatest ? `FY ${rrbBranchesLatest.period}` : 'No data',
          },
        ]}
      />
      <ChartGrid>
        <ChartBlock title="SCB deposits & credit over time">
          <TrendChart
            data={depositsCreditData}
            series={[
              { key: 'SCB deposits', label: 'SCB deposits', color: colors.categorical[0] },
              { key: 'SCB credit', label: 'SCB credit', color: colors.categorical[1] },
            ]}
            yFormatter={formatInrShort}
            colors={colors}
            title="SCB deposits & credit over time"
          />
        </ChartBlock>
        <ChartBlock title="Credit-deposit ratios over time (%)">
          <TrendChart
            data={cdRatioData}
            series={[
              { key: 'SCB C-D ratio (sanction)', label: 'SCB C-D (sanction)', color: colors.categorical[2] },
              { key: 'SCB C-D ratio (utilisation)', label: 'SCB C-D (utilisation)', color: colors.categorical[3] },
              { key: 'RRB C-D ratio', label: 'RRB C-D ratio', color: colors.categorical[5] },
            ]}
            yFormatter={pct1}
            colors={colors}
            title="Credit-deposit ratios over time (%)"
          />
        </ChartBlock>
        <ChartBlock title="Sectoral SCB credit over time">
          <TrendChart
            data={sectoralCreditData}
            series={[
              { key: 'Agriculture', label: 'Agriculture', color: colors.categorical[3] },
              { key: 'Industry', label: 'Industry', color: colors.categorical[0] },
              { key: 'Personal loans', label: 'Personal loans', color: colors.categorical[2] },
            ]}
            yFormatter={formatInrShort}
            colors={colors}
            title="Sectoral SCB credit over time"
          />
        </ChartBlock>
        <ChartBlock title="RRB deposits & credit over time">
          <TrendChart
            data={rrbData}
            series={[
              { key: 'RRB deposits', label: 'RRB deposits', color: colors.categorical[6] },
              { key: 'RRB credit', label: 'RRB credit', color: colors.categorical[7] },
            ]}
            yFormatter={formatInrShort}
            colors={colors}
            title="RRB deposits & credit over time"
          />
        </ChartBlock>
      </ChartGrid>
    </SectionCard>
  );
};

export default BankingProfileSection;
