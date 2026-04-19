/** Stable id for a sales capacity role (e.g. AE, AM, SR0). */
export type CapacityRoleId = string;
export type SelectedRoles = Record<string, boolean>;

export interface RoleAssumption {
  id: CapacityRoleId;
  name: string;
  annualQuota: number;
  rampMonths: number;
  rampPattern: number[];
  annualAttritionPct: number;
}

export interface HiringWave {
  roleId: CapacityRoleId;
  count: number;
  startDate: string;
}

export type BaselineHeadcount = Record<string, number>;

export interface GlobalSettings {
  fiscalYearStart: string;
  months: number;
  companyTargetAnnual: number;
  overAssignmentPct: number;
  seasonality: {
    /** Quarter weights as percentages (e.g. 25 for 25%). */
    quarterWeightsPct: [number, number, number, number];
    /** Split within each quarter as percentages for month 1/2/3 (e.g. 30/30/40). */
    withinQuarterPct: [number, number, number];
  };
}

export interface MonthlyRoleCapacity {
  headcount: number;
  capacity: number;
}

export interface MonthlyResult {
  month: string;
  target: number;
  capacity: number;
  assignedQuota: number;
  gap: number;
  byRole: Partial<Record<string, MonthlyRoleCapacity>>;
}

export interface CapacitySummary {
  totalHeadcount: Partial<Record<string, number>>;
  annualTarget: number;
  annualCapacity: number;
  annualAssignedQuota: number;
  annualGap: number;
}

export interface CapacityOutput {
  months: MonthlyResult[];
  summary: CapacitySummary;
}

/** SDR Capacity tab: org target and per-rep quota are measured in SQLs per year. */
export type SdrRoleId = string;

export interface SdrRoleAssumption {
  id: SdrRoleId;
  name: string;
  /** Expected SQLs per fully ramped rep per year. */
  annualQuota: number;
  rampMonths: number;
  rampPattern: number[];
  annualAttritionPct: number;
}

export interface SdrHiringWave {
  roleId: SdrRoleId;
  count: number;
  startDate: string;
}

/** Funnel $ metrics from monthly SQL capacity (MVP: no sales-cycle lag). */
export interface SdrPipelineAssumptions {
  /** Share of SQLs that become qualified opportunities (0–100). */
  sqlToOpportunityPct: number;
  averageOpportunitySize: number;
  /** Opportunity → closed-won (0–100). */
  opportunityToWonPct: number;
  /** Stored for future time-phased revenue; not used in MVP formulas. */
  salesCycleWeeks: number;
}

export interface SdrMonthlyResult {
  month: string;
  target: number;
  capacity: number;
  assignedQuota: number;
  gap: number;
  byRole: Record<string, MonthlyRoleCapacity>;
  /** Qualified opps / month from capacity × SQL→opp %. */
  opportunities: number;
  /** opportunities × average opportunity size ($). */
  pipelineValue: number;
  /** opportunities × win rate × average opportunity size ($). */
  expectedRevenue: number;
}

export interface SdrCapacitySummary {
  totalHeadcount: Record<string, number>;
  annualTarget: number;
  annualCapacity: number;
  annualAssignedQuota: number;
  annualGap: number;
  annualOpportunities: number;
  annualPipelineValue: number;
  annualExpectedRevenue: number;
}

export interface SdrCapacityOutput {
  months: SdrMonthlyResult[];
  summary: SdrCapacitySummary;
}

export interface DemandSettings {
  yearlyPaidMediaBudget: number;
  mqlFromPaidPct: number;
  mqlFromFreePct: number;
  targetCpl: number;
  mqlToOpportunityCr: number;
  opportunityToWonCr: number;
  yearlyRevenueTarget: number;
  inboundRevenuePct: number;
  outboundRevenuePct: number;
  averageDealSize: number;
}

export interface DemandMonthlyRow {
  month: string;
  mqlTotal: number;
  mqlPaid: number;
  mqlFree: number;
  opportunities: number;
  pipeline: number;
}

export interface DemandSummary {
  mqlInboundYear: number;
  mqlPaidYear: number;
  mqlFreeYear: number;
  opportunitiesYear: number;
  pipelineYear: number;
}

export interface DemandOutput {
  months: DemandMonthlyRow[];
  summary: DemandSummary;
}

// Pipeline planner (weekly back-calculation from won revenue target)
export interface PipelineSettings {
  // Split the won revenue target between existing business and new business
  yearlyRevenueTargetExisting: number;
  yearlyRevenueTargetNew: number;
  inboundRevenuePct: number;
  outboundRevenuePct: number;
  // Opp -> won conversion differs by business type
  opportunityToWonCrExisting: number;
  opportunityToWonCrNew: number;
  // Deal size differs by business type
  averageDealSizeExisting: number;
  averageDealSizeNew: number;
  // Average time from pipeline creation to won (in weeks)
  salesCycleWeeks: number;
}

export interface PipelineWeeklyRow {
  week: string;
  // Won revenue targets by week (these are the "outputs" we're trying to generate)
  wonInbound: number;
  wonOutbound: number;

  // Required pipeline creation to drive the won targets, shifted back by salesCycleWeeks
  pipelineInbound: number;
  pipelineOutbound: number;

  // Opportunities created required to create the pipeline
  oppsInbound: number;
  oppsOutbound: number;

  // Same numbers, but split by business type (Existing vs New).
  wonExisting: number;
  wonNew: number;
  pipelineExisting: number;
  pipelineNew: number;
  oppsExisting: number;
  oppsNew: number;

  pipelineTotal: number;
  oppsTotal: number;
}

export interface PipelineSummary {
  // Won revenue targets (should match existing/new revenue split)
  wonInboundYear: number;
  wonOutboundYear: number;
  wonTotalYear: number;

  // Required pipeline creation totals (already includes any clamping for early weeks)
  pipelineInboundYear: number;
  pipelineOutboundYear: number;
  pipelineTotalYear: number;

  oppsInboundYear: number;
  oppsOutboundYear: number;
  oppsTotalYear: number;

  // Split totals by business type.
  wonExistingYear: number;
  wonNewYear: number;
  pipelineExistingYear: number;
  pipelineNewYear: number;
  oppsExistingYear: number;
  oppsNewYear: number;

  // Wins in the early part of the year that technically require pipeline before week 0
  // (we clamp that pre-year requirement into week 0 for display)
  preYearPipelineInbound: number;
  preYearPipelineOutbound: number;
}

export interface PipelineOutput {
  weeks: PipelineWeeklyRow[];
  summary: PipelineSummary;
}

