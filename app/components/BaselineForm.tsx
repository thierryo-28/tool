import React from 'react';
import { BaselineHeadcount, RoleAssumption } from '@/lib/types';

interface Props {
  roles: RoleAssumption[];
  value: BaselineHeadcount;
  onChange(value: BaselineHeadcount): void;
}

export const BaselineForm: React.FC<Props> = ({ roles, value, onChange }) => {
  const handleChange =
    (roleId: keyof BaselineHeadcount) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next: BaselineHeadcount = {
        ...value,
        [roleId]: Number(e.target.value) || 0
      };
      onChange(next);
    };

  return (
    <div className="field-grid">
      {roles.map((role) => (
        <div className="field" key={role.id}>
          <label htmlFor={`baseline-${role.id}`}>
            {role.name} heads at start
          </label>
          <input
            id={`baseline-${role.id}`}
            type="number"
            min={0}
            value={value[role.id] ?? 0}
            onChange={handleChange(role.id)}
          />
        </div>
      ))}
    </div>
  );
};

