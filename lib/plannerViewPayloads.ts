import {
  BaselineHeadcount,
  DemandSettings,
  GlobalSettings,
  HiringWave,
  PipelineSettings,
  RoleAssumption,
  SelectedRoles,
  SdrHiringWave,
  SdrRoleAssumption
} from './types';

export type PlannerGlobals = Pick<
  GlobalSettings,
  'fiscalYearStart' | 'months' | 'seasonality'
>;

export function plannerGlobalsFromSettings(s: GlobalSettings): PlannerGlobals {
  return {
    fiscalYearStart: s.fiscalYearStart,
    months: s.months,
    seasonality: s.seasonality
  };
}

export function mergePlannerGlobals(
  base: GlobalSettings,
  g: Partial<PlannerGlobals>
): GlobalSettings {
  return {
    ...base,
    ...g,
    seasonality: g.seasonality ?? base.seasonality
  };
}

export interface CapacityViewPayload {
  kind: 'capacity';
  settings: GlobalSettings;
  roles: RoleAssumption[];
  waves: HiringWave[];
  baseline: BaselineHeadcount;
  selectedRoles: SelectedRoles;
  showResults: boolean;
}

export interface DemandViewPayload {
  kind: 'demand';
  globals: PlannerGlobals;
  demandSettings: DemandSettings;
}

export interface PipelineViewPayload {
  kind: 'pipeline';
  globals: PlannerGlobals;
  pipelineSettings: PipelineSettings;
}

export interface SdrViewPayload {
  kind: 'sdr';
  settings: GlobalSettings;
  sdrRole: SdrRoleAssumption;
  sdrWaves: SdrHiringWave[];
  sdrBaseline: number;
  showResults: boolean;
}

export type TabViewPayload =
  | CapacityViewPayload
  | DemandViewPayload
  | PipelineViewPayload
  | SdrViewPayload;
