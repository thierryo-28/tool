import {
  GlobalSettings,
  RoleAssumption,
  HiringWave,
  CapacityOutput,
  RoleId,
  MonthlyResult,
  MonthlyRoleCapacity,
  BaselineHeadcount
} from './types';

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

function evenMonthlyTargets(
  settings: GlobalSettings,
  monthCount: number
): number[] {
  const monthly = settings.companyTargetAnnual / monthCount;
  return Array(monthCount).fill(monthly);
}

export function seasonalMonthlyTargets(
  settings: GlobalSettings,
  monthCount: number
): number[] {
  const quarterWeights = settings.seasonality?.quarterWeightsPct ?? [25, 25, 25, 25];
  const withinQuarter = settings.seasonality?.withinQuarterPct ?? [33, 33, 34];

  const qwSum = quarterWeights.reduce((a, b) => a + b, 0) || 1;
  const wqSum = withinQuarter.reduce((a, b) => a + b, 0) || 1;

  const qw = quarterWeights.map((p) => p / qwSum);
  const wq = withinQuarter.map((p) => p / wqSum);

  const monthWeights: number[] = [];
  for (let i = 0; i < monthCount; i += 1) {
    const quarterIndex = Math.floor(i / 3) % 4;
    const withinIndex = i % 3;
    monthWeights.push(qw[quarterIndex] * wq[withinIndex]);
  }

  const totalWeight = monthWeights.reduce((a, b) => a + b, 0) || 1;
  return monthWeights.map((w) => (settings.companyTargetAnnual * w) / totalWeight);
}

function getAttritionDiscount(annualAttritionPct: number): number {
  return 1 - annualAttritionPct / 2;
}

function initializeRoleIds(roles: RoleAssumption[]): RoleId[] {
  return roles.map((r) => r.id);
}

export function calculateCapacity(
  settings: GlobalSettings,
  roles: RoleAssumption[],
  waves: HiringWave[],
  baseline?: BaselineHeadcount
): CapacityOutput {
  const months = buildMonthGrid(settings);
  const monthCount = months.length;
  const monthlyTargets = seasonalMonthlyTargets(settings, monthCount);
  const roleIds = initializeRoleIds(roles);

  const monthlyResults: MonthlyResult[] = months.map((month, idx) => {
    const byRole: Partial<Record<RoleId, MonthlyRoleCapacity>> = {};
    roleIds.forEach((roleId) => {
      byRole[roleId] = { headcount: 0, capacity: 0 };
    });

    return {
      month,
      target: monthlyTargets[idx],
      capacity: 0,
      assignedQuota: 0,
      gap: 0,
      byRole
    };
  });

  const roleById = new Map<RoleId, RoleAssumption>();
  roles.forEach((role) => {
    roleById.set(role.id, role);
  });

  waves.forEach((wave) => {
    const role = roleById.get(wave.roleId);
    if (!role) return;

    const startIndex = findMonthIndex(months, wave.startDate);
    if (startIndex === -1) {
      return;
    }

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

  if (baseline) {
    const monthsArr = months;
    const monthCountLocal = monthCount;
    Object.entries(baseline).forEach(([roleKey, count]) => {
      const roleId = roleKey as RoleId;
      if (!count || count <= 0) return;
      const role = roleById.get(roleId);
      if (!role) return;

      const baseMonthlyQuota = role.annualQuota / 12;
      const attritionDiscount = getAttritionDiscount(role.annualAttritionPct);

      for (let monthIdx = 0; monthIdx < monthCountLocal; monthIdx += 1) {
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
  }

  monthlyResults.forEach((result) => {
    result.assignedQuota = result.capacity * (1 + settings.overAssignmentPct);
    result.gap = result.assignedQuota - result.target;
  });

  const summaryHeadcount: Partial<Record<RoleId, number>> = {};

  let annualCapacity = 0;
  let annualAssignedQuota = 0;

  monthlyResults.forEach((result) => {
    annualCapacity += result.capacity;
    annualAssignedQuota += result.assignedQuota;

    roleIds.forEach((id) => {
      const monthHeadcount = result.byRole[id]?.headcount ?? 0;
      summaryHeadcount[id] = monthHeadcount;
    });
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

