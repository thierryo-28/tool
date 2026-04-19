import React, { Fragment } from 'react';
import type { SdrRoleAssumption } from '@/lib/types';
import { defaultRampPatternForMonths } from '@/lib/rampPatterns';

interface Props {
  roles: SdrRoleAssumption[];
  onChange(roles: SdrRoleAssumption[]): void;
}

export const SdrRoleAssumptionsTable: React.FC<Props> = ({
  roles,
  onChange
}) => {
  const updateRoleAt = (index: number, next: SdrRoleAssumption) => {
    const copy = [...roles];
    copy[index] = next;
    onChange(copy);
  };

  const handleFieldChange =
    (index: number, field: keyof SdrRoleAssumption) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const role = roles[index];
      if (!role) return;
      if (field === 'name') {
        updateRoleAt(index, { ...role, name: e.target.value });
      } else if (field === 'rampMonths') {
        const months = Math.min(12, Math.max(1, Number(e.target.value) || 1));
        updateRoleAt(index, {
          ...role,
          rampMonths: months,
          rampPattern: defaultRampPatternForMonths(months)
        });
      } else if (field === 'annualAttritionPct') {
        updateRoleAt(index, {
          ...role,
          annualAttritionPct: (Number(e.target.value) || 0) / 100
        });
      }
    };

  const handleAnnualQuotaChange = (index: number, annualQuota: number) => {
    const role = roles[index];
    if (!role) return;
    updateRoleAt(index, { ...role, annualQuota });
  };

  const handleRampStepChange = (
    roleIndex: number,
    stepIndex: number,
    percentRaw: number
  ) => {
    const role = roles[roleIndex];
    if (!role) return;
    const n = role.rampMonths;
    let pattern = [...role.rampPattern];
    if (pattern.length !== n) {
      pattern = defaultRampPatternForMonths(n);
    }
    const pct = Math.min(150, Math.max(0, percentRaw));
    pattern[stepIndex] = pct / 100;
    updateRoleAt(roleIndex, { ...role, rampPattern: pattern });
  };

  return (
    <div className="table-wrapper">
      {roles.map((role, index) => {
        const n = role.rampMonths;
        let pattern = role.rampPattern;
        if (pattern.length !== n) {
          pattern = defaultRampPatternForMonths(n);
        }
        return (
          <Fragment key={role.id}>
            <table style={{ marginTop: index > 0 ? 16 : 0 }}>
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
                      onChange={handleFieldChange(index, 'name')}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={role.annualQuota}
                      onChange={(e) =>
                        handleAnnualQuotaChange(
                          index,
                          Number(e.target.value) || 0
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={role.rampMonths}
                      onChange={handleFieldChange(index, 'rampMonths')}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(role.annualAttritionPct * 100)}
                      onChange={handleFieldChange(index, 'annualAttritionPct')}
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
                            <tr key={`sdr-ramp-${role.id}-${i.toString()}`}>
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
                                      index,
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
          </Fragment>
        );
      })}
    </div>
  );
};
