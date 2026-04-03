import React from 'react';
import type { SdrRoleAssumption } from '@/lib/types';

interface Props {
  value: SdrRoleAssumption;
  onChange(value: SdrRoleAssumption): void;
}

function defaultRampPatternForMonths(months: number): number[] {
  if (months <= 0) return [];
  if (months === 3) return [0.5, 0.75, 1];
  if (months === 4) return [0.25, 0.5, 0.75, 1];
  return Array(months).fill(1 / months);
}

export const SdrRoleAssumptionsTable: React.FC<Props> = ({
  value: role,
  onChange
}) => {
  const handleFieldChange =
    (field: keyof SdrRoleAssumption) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (field === 'name') {
        onChange({ ...role, name: e.target.value });
      } else if (field === 'rampMonths') {
        const months = Math.min(12, Math.max(1, Number(e.target.value) || 1));
        onChange({
          ...role,
          rampMonths: months,
          rampPattern: defaultRampPatternForMonths(months)
        });
      } else if (field === 'annualAttritionPct') {
        onChange({
          ...role,
          annualAttritionPct: (Number(e.target.value) || 0) / 100
        });
      }
    };

  const handleAnnualQuotaChange = (annualQuota: number) => {
    onChange({ ...role, annualQuota });
  };

  const handleRampStepChange = (stepIndex: number, percentRaw: number) => {
    const n = role.rampMonths;
    let pattern = [...role.rampPattern];
    if (pattern.length !== n) {
      pattern = defaultRampPatternForMonths(n);
    }
    const pct = Math.min(150, Math.max(0, percentRaw));
    pattern[stepIndex] = pct / 100;
    onChange({ ...role, rampPattern: pattern });
  };

  const n = role.rampMonths;
  let pattern = role.rampPattern;
  if (pattern.length !== n) {
    pattern = defaultRampPatternForMonths(n);
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>Annual SQL quota (per rep)</th>
            <th>Ramp (months)</th>
            <th>Attrition %</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <input
                type="text"
                value={role.name}
                onChange={handleFieldChange('name')}
              />
            </td>
            <td>
              <input
                type="number"
                min={0}
                step={1}
                value={role.annualQuota}
                onChange={(e) =>
                  handleAnnualQuotaChange(Number(e.target.value) || 0)
                }
              />
            </td>
            <td>
              <input
                type="number"
                min={1}
                max={12}
                value={role.rampMonths}
                onChange={handleFieldChange('rampMonths')}
              />
            </td>
            <td>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={Math.round(role.annualAttritionPct * 100)}
                onChange={handleFieldChange('annualAttritionPct')}
              />
            </td>
          </tr>
          <tr className="ramp-detail-row">
            <td colSpan={4}>
              <div className="ramp-block">
                <div className="ramp-block-title">
                  {role.name} — ramp by month (% of full monthly quota after
                  ramp)
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
                      <tr key={`sdr-ramp-${i.toString()}`}>
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
        </tbody>
      </table>
    </div>
  );
};
