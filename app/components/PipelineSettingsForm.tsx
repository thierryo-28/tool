import React from 'react';
import { PipelineSettings } from '@/lib/types';
import { CurrencyInput } from './CurrencyInput';

interface Props {
  value: PipelineSettings;
  onChange(value: PipelineSettings): void;
}

export const PipelineSettingsForm: React.FC<Props> = ({ value, onChange }) => {
  const setInboundPct = (inboundRevenuePct: number) => {
    const inbound = Math.min(100, Math.max(0, inboundRevenuePct));
    onChange({ ...value, inboundRevenuePct: inbound, outboundRevenuePct: 100 - inbound });
  };

  const setOutboundPct = (outboundRevenuePct: number) => {
    const outbound = Math.min(100, Math.max(0, outboundRevenuePct));
    onChange({ ...value, outboundRevenuePct: outbound, inboundRevenuePct: 100 - outbound });
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">Pipeline Planner assumptions</div>
          <div className="panel-subtitle">Plan pipeline creation need</div>
        </div>
      </div>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="pp-rev-existing">Yearly revenue target (existing)</label>
          <CurrencyInput
            id="pp-rev-existing"
            value={value.yearlyRevenueTargetExisting}
            onChange={(n) =>
              onChange({ ...value, yearlyRevenueTargetExisting: n })
            }
            min={0}
            placeholder="$0"
          />
        </div>

        <div className="field">
          <label htmlFor="pp-rev-new">Yearly revenue target (new)</label>
          <CurrencyInput
            id="pp-rev-new"
            value={value.yearlyRevenueTargetNew}
            onChange={(n) => onChange({ ...value, yearlyRevenueTargetNew: n })}
            min={0}
            placeholder="$0"
          />
        </div>

        <div className="field">
          <label htmlFor="pp-deal-existing">Average deal size (existing)</label>
          <CurrencyInput
            id="pp-deal-existing"
            value={value.averageDealSizeExisting}
            onChange={(n) =>
              onChange({ ...value, averageDealSizeExisting: n })
            }
            min={0}
            placeholder="$0"
          />
        </div>

        <div className="field">
          <label htmlFor="pp-deal-new">Average deal size (new)</label>
          <CurrencyInput
            id="pp-deal-new"
            value={value.averageDealSizeNew}
            onChange={(n) => onChange({ ...value, averageDealSizeNew: n })}
            min={0}
            placeholder="$0"
          />
        </div>

        <div className="field">
          <label htmlFor="pp-inbound">% revenue inbound</label>
          <input
            id="pp-inbound"
            type="number"
            min={0}
            max={100}
            value={value.inboundRevenuePct}
            onChange={(e) => setInboundPct(Number(e.target.value) || 0)}
          />
        </div>

        <div className="field">
          <label htmlFor="pp-outbound">% revenue outbound</label>
          <input
            id="pp-outbound"
            type="number"
            min={0}
            max={100}
            value={value.outboundRevenuePct}
            onChange={(e) => setOutboundPct(Number(e.target.value) || 0)}
          />
        </div>

        <div className="field">
          <label htmlFor="pp-oppwon-existing">
            Opportunity → Won conversion % (existing)
          </label>
          <input
            id="pp-oppwon-existing"
            type="number"
            min={0}
            max={100}
            step={1}
            value={value.opportunityToWonCrExisting}
            onChange={(e) =>
              onChange({
                ...value,
                opportunityToWonCrExisting: Number(e.target.value) || 0
              })
            }
          />
        </div>

        <div className="field">
          <label htmlFor="pp-oppwon-new">
            Opportunity → Won conversion % (new)
          </label>
          <input
            id="pp-oppwon-new"
            type="number"
            min={0}
            max={100}
            step={1}
            value={value.opportunityToWonCrNew}
            onChange={(e) =>
              onChange({
                ...value,
                opportunityToWonCrNew: Number(e.target.value) || 0
              })
            }
          />
        </div>

        <div className="field">
          <label htmlFor="pp-lag">Sales cycle (weeks)</label>
          <input
            id="pp-lag"
            type="number"
            min={0}
            max={104}
            step={1}
            value={value.salesCycleWeeks}
            onChange={(e) =>
              onChange({ ...value, salesCycleWeeks: Math.max(0, Number(e.target.value) || 0) })
            }
          />
        </div>
      </div>
    </section>
  );
};

