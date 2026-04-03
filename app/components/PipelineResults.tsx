import React from 'react';
import { PipelineOutput, PipelineSettings } from '@/lib/types';

interface Props {
  data: PipelineOutput;
  pipelineSettings: PipelineSettings;
}

function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '-';
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });
  return formatter.format(value);
}

function formatInteger(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatWeekLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit'
  });
}

export const PipelineResults: React.FC<Props> = ({ data, pipelineSettings }) => {
  const summary = data.summary;
  void pipelineSettings; // reconciliation is shown via engine-derived totals

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">Pipeline creation goals (weekly)</div>
          <div className="panel-subtitle">
            Existing + new business, back-shifted by sales cycle
          </div>
        </div>
      </div>

      <div className="summary-row">
        <div className="summary-card">
          <div className="summary-label">Pipeline to create / year</div>
          <div className="summary-value">{formatMoney(summary.pipelineTotalYear)}</div>
          <div className="summary-secondary">
            {summary.preYearPipelineInbound + summary.preYearPipelineOutbound > 0
              ? `Pre-year pipeline clamped into week 0: ${formatMoney(
                  summary.preYearPipelineInbound + summary.preYearPipelineOutbound
                )}`
              : null}
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-label">Existing pipeline / year</div>
          <div className="summary-value">{formatMoney(summary.pipelineExistingYear)}</div>
        </div>

        <div className="summary-card">
          <div className="summary-label">New pipeline / year</div>
          <div className="summary-value">{formatMoney(summary.pipelineNewYear)}</div>
        </div>

        <div className="summary-card">
          <div className="summary-label">Opportunities to create / year</div>
          <div className="summary-value">{formatInteger(summary.oppsTotalYear)}</div>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th>Existing won</th>
              <th>Existing pipeline</th>
              <th>Existing opps</th>
              <th>New won</th>
              <th>New pipeline</th>
              <th>New opps</th>
              <th>Total pipeline</th>
              <th>Total opps</th>
            </tr>
          </thead>
          <tbody>
            {data.weeks.map((row) => (
              <tr key={row.week}>
                <td>{formatWeekLabel(row.week)}</td>
                <td>{formatMoney(row.wonExisting)}</td>
                <td>{formatMoney(row.pipelineExisting)}</td>
                <td>{formatInteger(row.oppsExisting)}</td>
                <td>{formatMoney(row.wonNew)}</td>
                <td>{formatMoney(row.pipelineNew)}</td>
                <td>{formatInteger(row.oppsNew)}</td>
                <td>{formatMoney(row.pipelineTotal)}</td>
                <td>{formatInteger(row.oppsTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

