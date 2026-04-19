import {
  GlobalSettings,
  SdrCapacityOutput,
  SdrHiringWave,
  SdrMonthlyResult,
  SdrPipelineAssumptions,
  SdrRoleAssumption
} from './types';
import { seasonalMonthlyTargets } from './capacityEngine';

function addMonths(baseIsoDate: string, monthsToAdd: number): string {
  const date = new Date(baseIsoDate);
  date.setMonth(date.getMonth() + monthsToAdd);
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
}

function buildMonthGrid(settings: GlobalSettings): string[] {
  const months: string[] = [];
  for (let i = 0; i < settings.months; i += 1) {
    months.push(addMonths(settings.fiscalYearStart, i));
  }
  return months;
}

function findMonthIndex(months: string[], dateIso: string): number {
  const target = new Date(dateIso);
  const targetKey = `${target.getFullYear()}-${target.getMonth()}`;

  return months.findIndex((m) => {
    const d = new Date(m);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    return key === targetKey;
  });
}

function getAttritionDiscount(annualAttritionPct: number): number {
  return 1 - annualAttritionPct / 2;
}

function pctToUnit(p: number): number {
  if (!Number.isFinite(p)) return 0;
  return Math.min(1, Math.max(0, p / 100));
}

function emptyByRole(
  roleIds: string[]
): Record<string, { headcount: number; capacity: number }> {
  const byRole: Record<string, { headcount: number; capacity: number }> = {};
  roleIds.forEach((id) => {
    byRole[id] = { headcount: 0, capacity: 0 };
  });
  return byRole;
}

export function calculateSdrCapacity(
  settings: GlobalSettings,
  roles: SdrRoleAssumption[],
  waves: SdrHiringWave[],
  baselines: Record<string, number>,
  pipeline: SdrPipelineAssumptions
): SdrCapacityOutput {
  const months = buildMonthGrid(settings);
  const monthCount = months.length;
  const monthlyTargets = seasonalMonthlyTargets(settings, monthCount);
  const roleIds = roles.map((r) => r.id);
  const roleById = new Map(roles.map((r) => [r.id, r] as const));

  const sqlToOpp = pctToUnit(pipeline.sqlToOpportunityPct);
  const winRate = pctToUnit(pipeline.opportunityToWonPct);
  const acv = Math.max(0, pipeline.averageOpportunitySize);

  const monthlyResults: SdrMonthlyResult[] = months.map((month, idx) => ({
    month,
    target: monthlyTargets[idx],
    capacity: 0,
    assignedQuota: 0,
    gap: 0,
    byRole: emptyByRole(roleIds),
    opportunities: 0,
    pipelineValue: 0,
    expectedRevenue: 0
  }));

  waves.forEach((wave) => {
    const role = roleById.get(wave.roleId);
    if (!role) return;

    const startIndex = findMonthIndex(months, wave.startDate);
    if (startIndex === -1) return;

    const baseMonthlyQuota = role.annualQuota / 12;
    const attritionDiscount = getAttritionDiscount(role.annualAttritionPct);

    for (let monthIdx = startIndex; monthIdx < monthCount; monthIdx += 1) {
      const monthsSinceStart = monthIdx - startIndex;

      let rampFactor = 0;
      if (monthsSinceStart < 0) {
        rampFactor = 0;
      } else if (monthsSinceStart >= role.rampMonths) {
        rampFactor = 1;
      } else {
        rampFactor = role.rampPattern[monthsSinceStart] ?? 0;
      }

      const repCapacity =
        baseMonthlyQuota * rampFactor * wave.count * attritionDiscount;

      const result = monthlyResults[monthIdx];
      const roleBucket = result.byRole[wave.roleId];
      if (!roleBucket) continue;

      roleBucket.capacity += repCapacity;
      roleBucket.headcount += wave.count;
      result.capacity += repCapacity;
    }
  });

  Object.entries(baselines).forEach(([roleId, count]) => {
    if (!count || count <= 0) return;
    const role = roleById.get(roleId);
    if (!role) return;

    const baseMonthlyQuota = role.annualQuota / 12;
    const attritionDiscount = getAttritionDiscount(role.annualAttritionPct);

    for (let monthIdx = 0; monthIdx < monthCount; monthIdx += 1) {
      const repCapacity =
        baseMonthlyQuota * 1 * count * attritionDiscount;

      const result = monthlyResults[monthIdx];
      const roleBucket = result.byRole[roleId];
      if (!roleBucket) continue;

      roleBucket.capacity += repCapacity;
      roleBucket.headcount += count;
      result.capacity += repCapacity;
    }
  });

  monthlyResults.forEach((result) => {
    result.assignedQuota = result.capacity * (1 + settings.overAssignmentPct);
    result.gap = result.assignedQuota - result.target;
    const sqlVolume = result.capacity;
    const opps = sqlVolume * sqlToOpp;
    result.opportunities = opps;
    result.pipelineValue = opps * acv;
    result.expectedRevenue = opps * winRate * acv;
  });

  const summaryHeadcount: Record<string, number> = {};
  roleIds.forEach((id) => {
    summaryHeadcount[id] = 0;
  });

  let annualCapacity = 0;
  let annualAssignedQuota = 0;
  let annualOpportunities = 0;
  let annualPipelineValue = 0;
  let annualExpectedRevenue = 0;

  monthlyResults.forEach((result) => {
    annualCapacity += result.capacity;
    annualAssignedQuota += result.assignedQuota;
    annualOpportunities += result.opportunities;
    annualPipelineValue += result.pipelineValue;
    annualExpectedRevenue += result.expectedRevenue;
    roleIds.forEach((id) => {
      summaryHeadcount[id] = result.byRole[id]?.headcount ?? 0;
    });
  });

  const summary = {
    totalHeadcount: summaryHeadcount,
    annualTarget: settings.companyTargetAnnual,
    annualCapacity,
    annualAssignedQuota,
    annualGap: annualAssignedQuota - settings.companyTargetAnnual,
    annualOpportunities,
    annualPipelineValue,
    annualExpectedRevenue
  };

  return {
    months: monthlyResults,
    summary
  };
}
