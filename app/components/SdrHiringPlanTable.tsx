import React from 'react';
import type { SdrHiringWave } from '@/lib/types';

interface Props {
  value: SdrHiringWave[];
  onChange(value: SdrHiringWave[]): void;
}

export const SdrHiringPlanTable: React.FC<Props> = ({ value, onChange }) => {
  const handleChange =
    (index: number, field: keyof SdrHiringWave) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = [...value];
      const wave = { ...next[index] };
      if (field === 'count') {
        wave.count = Number(e.target.value) || 0;
      } else if (field === 'startDate') {
        wave.startDate = e.target.value;
      }
      next[index] = wave;
      onChange(next);
    };

  const addRow = () => {
    const today = new Date();
    const iso = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    ).toISOString();
    onChange([...value, { count: 1, startDate: iso }]);
  };

  const removeRow = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Heads</th>
            <th>Start month</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {value.map((wave, idx) => (
            <tr key={`sdr-wave-${idx.toString()}`}>
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
            <td colSpan={3}>
              <button
                type="button"
                onClick={addRow}
                className="button button-secondary button-small"
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
