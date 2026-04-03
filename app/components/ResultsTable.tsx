import React from 'react';
import type { CapacityOutput, RoleId, SdrCapacityOutput } from '@/lib/types';

interface Props {
  data: CapacityOutput | SdrCapacityOutput | null;
  roleIds: (RoleId | 'SDR')[];
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

export const ResultsTable: React.FC<Props> = ({
  data,
  roleIds,
  variant = 'currency'
}) => {
  const baseCols = 5;
  const totalCols = baseCols + roleIds.length;
  const targetLabel = variant === 'sql' ? 'Target (SQL)' : 'Target';

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
            {roleIds.map((roleId) => (
              <th key={roleId}>{roleId} HC</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.months.map((m) => {
            const rowWarning = m.capacity < m.target;
            const byRole = m.byRole as Record<
              string,
              { headcount: number } | undefined
            >;
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
                {roleIds.map((roleId) => (
                  <td key={roleId}>{byRole[roleId]?.headcount ?? 0}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

