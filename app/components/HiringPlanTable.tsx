import React from 'react';
import { HiringWave, RoleAssumption } from '@/lib/types';

interface Props {
  roles: RoleAssumption[];
  value: HiringWave[];
  onChange(value: HiringWave[]): void;
}

export const HiringPlanTable: React.FC<Props> = ({ roles, value, onChange }) => {
  const handleChange =
    (index: number, field: keyof HiringWave) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const next = [...value];
      const wave = { ...next[index] };
      if (field === 'roleId') {
        wave.roleId = e.target.value as HiringWave['roleId'];
      } else if (field === 'count') {
        wave.count = Number(e.target.value) || 0;
      } else if (field === 'startDate') {
        wave.startDate = e.target.value;
      }
      next[index] = wave;
      onChange(next);
    };

  const addRow = () => {
    const defaultRole = roles[0];
    if (!defaultRole) return;
    const today = new Date();
    const iso = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    ).toISOString();
    onChange([
      ...value,
      {
        roleId: defaultRole.id,
        count: 1,
        startDate: iso
      }
    ]);
  };

  const removeRow = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    onChange(next);
  };

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>Heads</th>
            <th>Start Month</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {roles.length === 0 ? (
            <tr>
              <td colSpan={4} className="muted">
                Select at least one role above to add hiring waves.
              </td>
            </tr>
          ) : null}
          {value.map((wave, idx) => (
            <tr key={`${wave.roleId}-${idx.toString()}`}>
              <td>
                <select
                  value={wave.roleId}
                  onChange={handleChange(idx, 'roleId')}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  value={wave.count}
                  onChange={handleChange(idx, 'count')}
                />
              </td>
              <td>
                <input
                  type="month"
                  value={wave.startDate.slice(0, 7)}
                  onChange={handleChange(idx, 'startDate')}
                />
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="button button-secondary button-small"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={4}>
              <button
                type="button"
                onClick={addRow}
                className="button button-secondary button-small"
                disabled={roles.length === 0}
              >
                Add hiring wave
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

