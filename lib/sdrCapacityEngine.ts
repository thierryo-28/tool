import {
  GlobalSettings,
  SdrCapacityOutput,
  SdrHiringWave,
  SdrMonthlyResult,
  SdrRoleAssumption,
  SdrRoleId
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

const SDR_ID: SdrRoleId = 'SDR';

export function calculateSdrCapacity(
  settings: GlobalSettings,
  role: SdrRoleAssumption,
  waves: SdrHiringWave[],
  baselineSdr: number
): SdrCapacityOutput {
  const months = buildMonthGrid(settings);
  const monthCount = months.length;
  const monthlyTargets = seasonalMonthlyTargets(settings, monthCount);

  const monthlyResults: SdrMonthlyResult[] = months.map((month, idx) => ({
    month,
    target: monthlyTargets[idx],
    capacity: 0,
    assignedQuota: 0,
    gap: 0,
    byRole: {
      SDR: { headcount: 0, capacity: 0 }
    }
  }));

  waves.forEach((wave) => {
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
      const roleBucket = result.byRole[SDR_ID];
      roleBucket.capacity += repCapacity;
      roleBucket.headcount += wave.count;
      result.capacity += repCapacity;
    }
  });

  if (baselineSdr > 0) {
    const baseMonthlyQuota = role.annualQuota / 12;
    const attritionDiscount = getAttritionDiscount(role.annualAttritionPct);

    for (let monthIdx = 0; monthIdx < monthCount; monthIdx += 1) {
      const repCapacity =
        baseMonthlyQuota * 1 * baselineSdr * attritionDiscount;

      const result = monthlyResults[monthIdx];
      const roleBucket = result.byRole[SDR_ID];
      roleBucket.capacity += repCapacity;
      roleBucket.headcount += baselineSdr;
      result.capacity += repCapacity;
    }
  }

  monthlyResults.forEach((result) => {
    result.assignedQuota = result.capacity * (1 + settings.overAssignmentPct);
    result.gap = result.assignedQuota - result.target;
  });

  const summaryHeadcount: Record<SdrRoleId, number> = { SDR: 0 };

  let annualCapacity = 0;
  let annualAssignedQuota = 0;

  monthlyResults.forEach((result) => {
    annualCapacity += result.capacity;
    annualAssignedQuota += result.assignedQuota;
    summaryHeadcount[SDR_ID] = result.byRole[SDR_ID]?.headcount ?? 0;
  });

  const summary = {
    totalHeadcount: summaryHeadcount,
    annualTarget: settings.companyTargetAnnual,
    annualCapacity,
    annualAssignedQuota,
    annualGap: annualAssignedQuota - settings.companyTargetAnnual
  };

  return {
    months: monthlyResults,
    summary
  };
}
