import React from 'react';
import type { CapacityOutput, SdrCapacityOutput } from '@/lib/types';

interface Props {
  data: CapacityOutput | SdrCapacityOutput | null;
  roleIds: (string)[];
  /** Reserved for future header tweaks; values are always numeric. */
  variant?: 'currency' | 'sql';
}

function formatMonthLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    year: '2-digit'
  });
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 0
  });
}

function formatCurrencyUsd(value: number): string {
  if (!Number.isFinite(value)) return '-';
  const rounded = Math.round(value);
  return `$${rounded.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function isSdrPipelineData(
  d: CapacityOutput | SdrCapacityOutput
): d is SdrCapacityOutput {
  return 'annualPipelineValue' in d.summary;
}

export const ResultsTable: React.FC<Props> = ({
  data,
  roleIds,
  variant = 'currency'
}) => {
  const targetLabel = variant === 'sql' ? 'Target (SQL)' : 'Target';
  const showPipelineCols = variant === 'sql';
  const pipelineMetrics =
    data !== null && isSdrPipelineData(data) ? data : null;

  const baseCols = showPipelineCols ? 7 : 5;
  const totalCols = baseCols + roleIds.length;

  if (!data) {
    return (
      <div className="table-wrapper muted">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>{targetLabel}</th>
              <th>Capacity</th>
              <th>Assigned</th>
              <th>Gap</th>
              {showPipelineCols ? (
                <>
                  <th>Pipeline ($)</th>
                  <th>Expected revenue ($)</th>
                </>
              ) : null}
              {roleIds.map((roleId) => (
                <th key={roleId}>{roleId} HC</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={totalCols}>
                No plan yet. Adjust assumptions and calculate.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  const { months } = data;
  const lastRow = months[months.length - 1];
  const byRoleLast = lastRow?.byRole as
    | Record<string, { headcount: number } | undefined>
    | undefined;

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th>{targetLabel}</th>
            <th>Capacity</th>
            <th>Assigned</th>
            <th>Gap</th>
            {showPipelineCols ? (
              <>
                <th>Pipeline ($)</th>
                <th>Expected revenue ($)</th>
              </>
            ) : null}
            {roleIds.map((roleId) => (
              <th key={roleId}>{roleId} HC</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((m) => {
            const rowWarning = m.capacity < m.target;
            const byRole = m.byRole as Record<
              string,
              { headcount: number } | undefined
            >;
            const sdrRow =
              pipelineMetrics && 'pipelineValue' in m
                ? (m as SdrCapacityOutput['months'][number])
                : null;
            return (
              <tr
                key={m.month}
                className={rowWarning ? 'row-warning' : undefined}
              >
                <td>{formatMonthLabel(m.month)}</td>
                <td>{formatNumber(m.target)}</td>
                <td>{formatNumber(m.capacity)}</td>
                <td>{formatNumber(m.assignedQuota)}</td>
                <td
                  className={
                    m.gap > 0
                      ? 'gap-cell-positive'
                      : m.gap < 0
                        ? 'gap-cell-negative'
                        : undefined
                  }
                >
                  {formatNumber(m.gap)}
                </td>
                {showPipelineCols ? (
                  sdrRow ? (
                    <>
                      <td>{formatCurrencyUsd(sdrRow.pipelineValue)}</td>
                      <td>{formatCurrencyUsd(sdrRow.expectedRevenue)}</td>
                    </>
                  ) : (
                    <>
                      <td>–</td>
                      <td>–</td>
                    </>
                  )
                ) : null}
                {roleIds.map((roleId) => (
                  <td key={roleId}>{byRole[roleId]?.headcount ?? 0}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
        {pipelineMetrics ? (
          <tfoot>
            <tr className="table-foot-total">
              <td>Year total</td>
              <td>{formatNumber(pipelineMetrics.summary.annualTarget)}</td>
              <td>{formatNumber(pipelineMetrics.summary.annualCapacity)}</td>
              <td>
                {formatNumber(pipelineMetrics.summary.annualAssignedQuota)}
              </td>
              <td
                className={
                  pipelineMetrics.summary.annualGap > 0
                    ? 'gap-cell-positive'
                    : pipelineMetrics.summary.annualGap < 0
                      ? 'gap-cell-negative'
                      : undefined
                }
              >
                {formatNumber(pipelineMetrics.summary.annualGap)}
              </td>
              <td>
                {formatCurrencyUsd(pipelineMetrics.summary.annualPipelineValue)}
              </td>
              <td>
                {formatCurrencyUsd(
                  pipelineMetrics.summary.annualExpectedRevenue
                )}
              </td>
              {roleIds.map((roleId) => (
                <td key={roleId}>
                  {byRoleLast?.[roleId]?.headcount ?? 0}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
};
