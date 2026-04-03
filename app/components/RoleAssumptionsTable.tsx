import React from 'react';
import { RoleAssumption } from '@/lib/types';
import { CurrencyInput } from './CurrencyInput';

interface Props {
  value: RoleAssumption[];
  onChange(value: RoleAssumption[]): void;
}

/** Default ramp curve for a given number of months (0–1 per month). */
function defaultRampPatternForMonths(months: number): number[] {
  if (months <= 0) return [];
  if (months === 3) return [0.5, 0.75, 1];
  if (months === 4) return [0.25, 0.5, 0.75, 1];
  return Array(months).fill(1 / months);
}

export const RoleAssumptionsTable: React.FC<Props> = ({
  value,
  onChange
}) => {
  const handleFieldChange =
    (index: number, field: keyof RoleAssumption) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = [...value];
      const role = { ...next[index] };
      if (field === 'name') {
        role.name = e.target.value;
      } else if (field === 'rampMonths') {
        const months = Math.min(12, Math.max(1, Number(e.target.value) || 1));
        role.rampMonths = months;
        role.rampPattern = defaultRampPatternForMonths(months);
      } else if (field === 'annualAttritionPct') {
        role.annualAttritionPct = (Number(e.target.value) || 0) / 100;
      }
      next[index] = role;
      onChange(next);
    };

  const handleAnnualQuotaChange = (index: number, annualQuota: number) => {
    const next = [...value];
    next[index] = { ...next[index], annualQuota };
    onChange(next);
  };

  const handleRampStepChange = (
    roleIndex: number,
    stepIndex: number,
    percentRaw: number
  ) => {
    const next = [...value];
    const role = { ...next[roleIndex] };
    const n = role.rampMonths;
    let pattern = [...role.rampPattern];
    if (pattern.length !== n) {
      pattern = defaultRampPatternForMonths(n);
    }
    const pct = Math.min(150, Math.max(0, percentRaw));
    pattern[stepIndex] = pct / 100;
    role.rampPattern = pattern;
    next[roleIndex] = role;
    onChange(next);
  };

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>Annual Quota</th>
            <th>Ramp (months)</th>
            <th>Attrition %</th>
          </tr>
        </thead>
        <tbody>
          {value.map((role, idx) => {
            const n = role.rampMonths;
            let pattern = role.rampPattern;
            if (pattern.length !== n) {
              pattern = defaultRampPatternForMonths(n);
            }
            return (
              <React.Fragment key={role.id}>
                <tr>
                  <td>{role.name}</td>
                  <td>
                    <CurrencyInput
                      value={role.annualQuota}
                      onChange={(n) => handleAnnualQuotaChange(idx, n)}
                      min={0}
                      placeholder="$0"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={role.rampMonths}
                      onChange={handleFieldChange(idx, 'rampMonths')}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(role.annualAttritionPct * 100)}
                      onChange={handleFieldChange(idx, 'annualAttritionPct')}
                    />
                  </td>
                </tr>
                <tr className="ramp-detail-row">
                  <td colSpan={4}>
                    <div className="ramp-block">
                      <div className="ramp-block-title">
                        {role.name} — ramp by month (% of full monthly quota
                        after ramp)
                      </div>
                      <table className="ramp-nested-table">
                        <thead>
                          <tr>
                            <th>Month since start</th>
                            <th>Productivity %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: n }, (_, i) => (
                            <tr key={`${role.id}-ramp-${i.toString()}`}>
                              <td>{i + 1}</td>
                              <td>
                                <input
                                  type="number"
                                  min={0}
                                  max={150}
                                  step={1}
                                  value={Math.round(pattern[i] * 100)}
                                  onChange={(e) =>
                                    handleRampStepChange(
                                      idx,
                                      i,
                                      Number(e.target.value) || 0
                                    )
                                  }
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
