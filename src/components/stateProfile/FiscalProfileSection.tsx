import React, { useEffect, useMemo, useState } from 'react';
import { fetchFiscalFinancialYearSeries, FISCAL_METRICS } from '../../api/fiscalApi';
import { formatInrShort } from '../../utils/format';
import { useTheme } from '../../theme/ThemeContext';
import { CHART_COLORS } from '../../theme/chartColors';
import {
  MetricRow,
  SectionCard,
  ChartGrid,
  ChartBlock,
  TrendChart,
  buildTrendData,
  hasAnyValue,
  fetchMetricRows,
} from './profileWidgets';

interface Props {
  state: string;
}

const FiscalProfileSection: React.FC<Props> = ({ state }) => {
  const { theme } = useTheme();
  const colors = CHART_COLORS[theme];

  const [rows, setRows] = useState<Record<string, MetricRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchMetricRows(fetchFiscalFinancialYearSeries, FISCAL_METRICS)
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Unable to load Fiscal data.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const deficitsData = useMemo(
    () =>
      buildTrendData(
        {
          'Gross fiscal deficit': rows.grossFiscalDeficit,
          'Revenue deficit': rows.revenueDeficit,
          'Primary deficit': rows.primaryDeficit,
        },
        state
      ),
    [rows, state]
  );
  const revenueData = useMemo(
    () =>
      buildTrendData(
        { 'Own tax revenue': rows.ownTaxRevenue, 'Own non-tax revenue': rows.ownNonTaxRevenue },
        state
      ),
    [rows, state]
  );
  const expenditureData = useMemo(
    () =>
      buildTrendData(
        {
          'Revenue expenditure': rows.revenueExpenditure,
          'Interest payments': rows.interestPayments,
          Pension: rows.pensionExpenditure,
          'Social sector': rows.socialSectorExpenditure,
        },
        state
      ),
    [rows, state]
  );
  const capitalData = useMemo(
    () =>
      buildTrendData(
        {
          'Capital receipts': rows.capitalReceipts,
          'Capital expenditure': rows.capitalExpenditure,
          'Capital outlay': rows.capitalOutlay,
        },
        state
      ),
    [rows, state]
  );
  const debtData = useMemo(
    () =>
      buildTrendData(
        {
          'Outstanding liabilities': rows.outstandingLiabilities,
          'Outstanding guarantees': rows.outstandingGuarantees,
          'Market borrowings': rows.marketBorrowings,
        },
        state
      ),
    [rows, state]
  );

  const empty =
    !loading &&
    !hasAnyValue(deficitsData, ['Gross fiscal deficit', 'Revenue deficit', 'Primary deficit']) &&
    !hasAnyValue(revenueData, ['Own tax revenue', 'Own non-tax revenue']) &&
    !hasAnyValue(expenditureData, ['Revenue expenditure', 'Interest payments', 'Pension', 'Social sector']) &&
    !hasAnyValue(capitalData, ['Capital receipts', 'Capital expenditure', 'Capital outlay']) &&
    !hasAnyValue(debtData, ['Outstanding liabilities', 'Outstanding guarantees', 'Market borrowings']);

  return (
    <SectionCard
      title="4 · Fiscal"
      description="Deficits, own-source revenue, expenditure priorities, the capital account, and the outstanding debt position."
      loading={loading}
      error={error}
      empty={empty}
      stateName={state}
    >
      <ChartGrid>
        <ChartBlock title="Deficits over time">
          <TrendChart
            data={deficitsData}
            series={[
              { key: 'Gross fiscal deficit', label: 'Gross fiscal deficit', color: colors.categorical[5] },
              { key: 'Revenue deficit', label: 'Revenue deficit', color: colors.categorical[0] },
              { key: 'Primary deficit', label: 'Primary deficit', color: colors.categorical[4] },
            ]}
            yFormatter={formatInrShort}
            colors={colors}
            title="Deficits over time"
          />
        </ChartBlock>
        <ChartBlock title="Own-source revenue over time">
          <TrendChart
            data={revenueData}
            series={[
              { key: 'Own tax revenue', label: 'Own tax revenue', color: colors.ink },
              { key: 'Own non-tax revenue', label: 'Own non-tax revenue', color: colors.categorical[2] },
            ]}
            yFormatter={formatInrShort}
            colors={colors}
            title="Own-source revenue over time"
          />
        </ChartBlock>
        <ChartBlock title="Expenditure over time">
          <TrendChart
            data={expenditureData}
            series={[
              { key: 'Revenue expenditure', label: 'Revenue expenditure', color: colors.categorical[0] },
              { key: 'Interest payments', label: 'Interest payments', color: colors.categorical[5] },
              { key: 'Pension', label: 'Pension', color: colors.categorical[4] },
              { key: 'Social sector', label: 'Social sector', color: colors.categorical[1] },
            ]}
            yFormatter={formatInrShort}
            colors={colors}
            title="Expenditure over time"
          />
        </ChartBlock>
        <ChartBlock title="Capital account over time">
          <TrendChart
            data={capitalData}
            series={[
              { key: 'Capital receipts', label: 'Capital receipts', color: colors.categorical[2] },
              { key: 'Capital expenditure', label: 'Capital expenditure', color: colors.categorical[6] },
              { key: 'Capital outlay', label: 'Capital outlay', color: colors.categorical[3] },
            ]}
            yFormatter={formatInrShort}
            colors={colors}
            title="Capital account over time"
          />
        </ChartBlock>
        <ChartBlock title="Debt & guarantees over time">
          <TrendChart
            data={debtData}
            series={[
              { key: 'Outstanding liabilities', label: 'Outstanding liabilities', color: colors.categorical[5] },
              { key: 'Outstanding guarantees', label: 'Outstanding guarantees', color: colors.categorical[7] },
              { key: 'Market borrowings', label: 'Market borrowings', color: colors.categorical[0] },
            ]}
            yFormatter={formatInrShort}
            colors={colors}
            title="Debt & guarantees over time"
          />
        </ChartBlock>
      </ChartGrid>
    </SectionCard>
  );
};

export default FiscalProfileSection;
