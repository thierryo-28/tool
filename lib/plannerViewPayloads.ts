import {
  BaselineHeadcount,
  DemandSettings,
  GlobalSettings,
  HiringWave,
  PipelineSettings,
  RoleAssumption,
  SelectedRoles,
  SdrHiringWave,
  SdrPipelineAssumptions,
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
  sdrRoles: SdrRoleAssumption[];
  sdrWaves: SdrHiringWave[];
  sdrBaselines: Record<string, number>;
  /** Omitted in older saved views; client applies defaults. */
  sdrPipeline?: SdrPipelineAssumptions;
  showResults: boolean;
}

export type TabViewPayload =
  | CapacityViewPayload
  | DemandViewPayload
  | PipelineViewPayload
  | SdrViewPayload;

/** Single-role SDR payloads persisted before multi-role support. */
export type LegacySdrViewPayload = {
  kind: 'sdr';
  settings: GlobalSettings;
  sdrRole: SdrRoleAssumption;
  sdrWaves: Array<{
    roleId?: string;
    count: number;
    startDate: string;
  }>;
  sdrBaseline: number;
  sdrPipeline?: SdrPipelineAssumptions;
  showResults: boolean;
};

function normalizeIsoDateString(startDate: string): string {
  return String(startDate);
}

/**
 * Normalize legacy single-role SDR payloads and ensure every wave has roleId.
 */
export function normalizeSdrViewPayload(
  p: SdrViewPayload | LegacySdrViewPayload | Record<string, unknown> | unknown
): SdrViewPayload {
  if (!p || typeof p !== 'object' || (p as { kind?: string }).kind !== 'sdr') {
    throw new Error('Invalid SDR payload');
  }
  const o = p as Record<string, unknown>;
  const settings = o.settings as GlobalSettings;
  const showResults = Boolean(o.showResults);
  const pipeline = o.sdrPipeline as SdrPipelineAssumptions | undefined;
  const rawWaves = Array.isArray(o.sdrWaves) ? o.sdrWaves : [];

  if (Array.isArray(o.sdrRoles) && (o.sdrRoles as SdrRoleAssumption[]).length > 0) {
    const sdrRoles = o.sdrRoles as SdrRoleAssumption[];
    const baselinesRaw = o.sdrBaselines as Record<string, number> | undefined;
    const sdrBaselines: Record<string, number> = {};
    sdrRoles.forEach((r) => {
      const v = baselinesRaw?.[r.id];
      sdrBaselines[r.id] =
        typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
    });
    const sdrWaves: SdrHiringWave[] = rawWaves.map((w) => {
      const row = w as {
        roleId?: string;
        count: number;
        startDate: string;
      };
      return {
        roleId: row.roleId ?? sdrRoles[0]!.id,
        count: Math.max(0, Math.round(Number(row.count) || 0)),
        startDate: normalizeIsoDateString(row.startDate)
      };
    });
    return {
      kind: 'sdr',
      settings,
      sdrRoles,
      sdrWaves,
      sdrBaselines,
      sdrPipeline: pipeline,
      showResults
    };
  }

  const sdrRole = o.sdrRole as SdrRoleAssumption | undefined;
  if (!sdrRole || typeof sdrRole !== 'object') {
    throw new Error('Missing sdrRole or sdrRoles in SDR payload');
  }
  const n = Math.max(0, Math.round(Number(o.sdrBaseline) || 0));
  const sdrWaves: SdrHiringWave[] = rawWaves.map((w) => {
    const row = w as {
      roleId?: string;
      count: number;
      startDate: string;
    };
    return {
      roleId: row.roleId ?? sdrRole.id,
      count: Math.max(0, Math.round(Number(row.count) || 0)),
      startDate: normalizeIsoDateString(row.startDate)
    };
  });
  return {
    kind: 'sdr',
    settings,
    sdrRoles: [sdrRole],
    sdrWaves,
    sdrBaselines: { [sdrRole.id]: n },
    sdrPipeline: pipeline,
    showResults
  };
}
