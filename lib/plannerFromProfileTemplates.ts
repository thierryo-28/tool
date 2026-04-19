import type { SalesRoleTemplateRow, SdrRoleTemplateRow } from './profilePlannerSettings';
import { defaultRampPatternForMonths } from './rampPatterns';
import type { RoleAssumption, SdrRoleAssumption } from './types';

export function salesRolesFromTemplates(
  templates: SalesRoleTemplateRow[]
): RoleAssumption[] {
  return templates.map((t, i) => {
    const rampMonths = Math.min(12, Math.max(1, Math.round(t.rampMonths)));
    return {
      id: `SR${i}`,
      name: t.title.trim() || `Sales role ${i + 1}`,
      annualQuota: Math.max(0, t.defaultAnnualQuota),
      rampMonths,
      rampPattern: defaultRampPatternForMonths(rampMonths),
      annualAttritionPct: 0.1
    };
  });
}

export function sdrRolesFromTemplates(
  templates: SdrRoleTemplateRow[]
): SdrRoleAssumption[] {
  return templates.map((t, i) => {
    const rampMonths = Math.min(12, Math.max(1, Math.round(t.rampMonths)));
    return {
      id: `DR${i}`,
      name: t.title.trim() || `SDR role ${i + 1}`,
      annualQuota: Math.max(0, t.defaultAnnualSqlQuota),
      rampMonths,
      rampPattern: defaultRampPatternForMonths(rampMonths),
      annualAttritionPct: 0.12
    };
  });
}

export function selectedRolesForIds(ids: string[]): Record<string, boolean> {
  return Object.fromEntries(ids.map((id) => [id, true]));
}

export function zeroBaselinesForIds(ids: string[]): Record<string, number> {
  return Object.fromEntries(ids.map((id) => [id, 0]));
}
