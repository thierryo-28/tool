import React from 'react';
import type { CapacityOutput, SdrCapacityOutput } from '@/lib/types';

interface Props {
  data: CapacityOutput | SdrCapacityOutput | null;
  /** `sql`: show SQL counts instead of currency. */
  variant?: 'currency' | 'sql';
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '-';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(1)}k`;
  }
  return `${sign}${abs.toFixed(0)}`;
}

function formatSql(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return Math.round(value).toLocaleString();
}

function isSdrPipelineSummary(
  s: CapacityOutput['summary'] | SdrCapacityOutput['summary']
): s is SdrCapacityOutput['summary'] {
  return 'annualPipelineValue' in s;
}

export const ResultsSummary: React.FC<Props> = ({ data, variant = 'currency' }) => {
  const fmt = variant === 'sql' ? formatSql : formatCurrency;
  const prefix = variant === 'sql' ? '' : '$';

  if (!data) {
    return (
      <>
        <div className="summary-row">
          <div className="summary-card muted">
            <div className="summary-label">
              {variant === 'sql' ? 'Annual SQL target' : 'Annual Target'}
            </div>
            <div className="summary-value">–</div>
          </div>
          <div className="summary-card muted">
            <div className="summary-label">Annual Capacity</div>
            <div className="summary-value">–</div>
          </div>
          <div className="summary-card muted">
            <div className="summary-label">Assigned quota</div>
            <div className="summary-value">–</div>
          </div>
          <div className="summary-card muted">
            <div className="summary-label">Annual Gap</div>
            <div className="summary-value">–</div>
          </div>
        </div>
        {variant === 'sql' ? (
          <div className="summary-row" style={{ marginTop: 10 }}>
            <div className="summary-card muted">
              <div className="summary-label">Year pipeline ($)</div>
              <div className="summary-value">–</div>
            </div>
            <div className="summary-card muted">
              <div className="summary-label">Year expected revenue ($)</div>
              <div className="summary-value">–</div>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  const { summary } = data;
  const gapPositive = summary.annualGap >= 0;

  const pipelineSummary =
    variant === 'sql' && isSdrPipelineSummary(summary) ? summary : null;

  return (
    <>
      <div className="summary-row">
        <div className="summary-card">
          <div className="summary-label">
            {variant === 'sql' ? 'Annual SQL target' : 'Annual Target'}
          </div>
          <div className="summary-value">
            {prefix}
            {fmt(summary.annualTarget)}
            {variant === 'sql' ? ' SQL' : ''}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Annual Capacity</div>
          <div className="summary-value">
            {prefix}
            {fmt(summary.annualCapacity)}
            {variant === 'sql' ? ' SQL' : ''}
          </div>
          <div className="summary-secondary">
            Capacity from all heads after ramp & attrition
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Assigned quota</div>
          <div className="summary-value">
            {prefix}
            {fmt(summary.annualAssignedQuota)}
            {variant === 'sql' ? ' SQL' : ''}
          </div>
          <div className="summary-secondary">
            Includes over-assignment factor
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Annual Gap</div>
          <div
            className={`summary-value ${
              gapPositive ? 'summary-positive' : 'summary-negative'
            }`}
          >
            {prefix}
            {fmt(summary.annualGap)}
            {variant === 'sql' ? ' SQL' : ''}
          </div>
          <div className="summary-secondary">
            {gapPositive ? 'Above target' : 'Below target'}
          </div>
        </div>
      </div>
      {pipelineSummary ? (
        <div className="summary-row" style={{ marginTop: 10 }}>
          <div className="summary-card">
            <div className="summary-label">Year pipeline ($)</div>
            <div className="summary-value">
              ${formatCurrency(pipelineSummary.annualPipelineValue)}
            </div>
            <div className="summary-secondary">
              From capacity × SQL→opp × ACV
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Year expected revenue ($)</div>
            <div className="summary-value">
              ${formatCurrency(pipelineSummary.annualExpectedRevenue)}
            </div>
            <div className="summary-secondary">
              × win rate; same-month view (no cycle lag)
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

