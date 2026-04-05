'use client';

import React from 'react';
import type { SdrPipelineAssumptions } from '@/lib/types';
import { CurrencyInput } from './CurrencyInput';

interface Props {
  value: SdrPipelineAssumptions;
  onChange: (next: SdrPipelineAssumptions) => void;
}

export const SdrPipelineAssumptionsForm: React.FC<Props> = ({
  value,
  onChange
}) => {
  const patch = (partial: Partial<SdrPipelineAssumptions>) => {
    onChange({ ...value, ...partial });
  };

  return (
    <div className="field-grid">
      <div className="field">
        <label htmlFor="sdr-sql-opp-cr">SQL → opportunity %</label>
        <input
          id="sdr-sql-opp-cr"
          type="number"
          min={0}
          max={100}
          value={value.sqlToOpportunityPct}
          onChange={(e) =>
            patch({ sqlToOpportunityPct: Number(e.target.value) || 0 })
          }
        />
        <div className="field-hint">Share of SQLs that become qualified opps</div>
      </div>
      <div className="field">
        <label htmlFor="sdr-acv">Average opportunity size</label>
        <CurrencyInput
          id="sdr-acv"
          value={value.averageOpportunitySize}
          onChange={(n) => patch({ averageOpportunitySize: n })}
          min={0}
          placeholder="$0"
        />
      </div>
      <div className="field">
        <label htmlFor="sdr-win">Opportunity → won %</label>
        <input
          id="sdr-win"
          type="number"
          min={0}
          max={100}
          value={value.opportunityToWonPct}
          onChange={(e) =>
            patch({ opportunityToWonPct: Number(e.target.value) || 0 })
          }
        />
      </div>
      <div className="field">
        <label htmlFor="sdr-cycle">Sales cycle (weeks)</label>
        <input
          id="sdr-cycle"
          type="number"
          min={0}
          max={104}
          value={value.salesCycleWeeks}
          onChange={(e) =>
            patch({ salesCycleWeeks: Math.max(0, Number(e.target.value) || 0) })
          }
        />
        <div className="field-hint">For reference; not applied in monthly $ yet</div>
      </div>
    </div>
  );
};
