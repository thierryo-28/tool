export const PROFILE_PLANNER_SETTINGS_VERSION = 1 as const;

export const MAX_SALES_TEMPLATE_ROLES = 6;
export const MAX_SDR_TEMPLATE_ROLES = 3;

export interface SalesRoleTemplateRow {
  title: string;
  rampMonths: number;
  defaultAnnualQuota: number;
}

export interface SdrRoleTemplateRow {
  title: string;
  rampMonths: number;
  defaultAnnualSqlQuota: number;
}

export interface ProfilePlannerSettings {
  version: typeof PROFILE_PLANNER_SETTINGS_VERSION;
  salesTemplates: SalesRoleTemplateRow[];
  sdrTemplates: SdrRoleTemplateRow[];
}

export function emptyProfilePlannerSettings(): ProfilePlannerSettings {
  return {
    version: PROFILE_PLANNER_SETTINGS_VERSION,
    salesTemplates: [],
    sdrTemplates: []
  };
}
