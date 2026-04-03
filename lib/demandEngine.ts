import { DemandOutput, DemandSettings, GlobalSettings } from './types';
import { seasonalMonthlyTargets } from './capacityEngine';

export function calculateDemandPlan(
  global: GlobalSettings,
  demand: DemandSettings
): DemandOutput {
  const months = global.months;

  const revInbound = demand.yearlyRevenueTarget * (demand.inboundRevenuePct / 100);
  const dealsInbound = demand.averageDealSize > 0 ? revInbound / demand.averageDealSize : 0;
  const oppInbound =
    demand.opportunityToWonCr > 0 ? dealsInbound / (demand.opportunityToWonCr / 100) : 0;
  const mqlInbound =
    demand.mqlToOpportunityCr > 0 ? oppInbound / (demand.mqlToOpportunityCr / 100) : 0;

  const mqlPaidYear = mqlInbound * (demand.mqlFromPaidPct / 100);
  const mqlFreeYear = mqlInbound * (demand.mqlFromFreePct / 100);

  const annualTargetForMql = mqlInbound || 1;
  const perMonthMqlTargets = seasonalMonthlyTargets(
    {
      ...global,
      companyTargetAnnual: annualTargetForMql
    },
    months
  );

  const rows = perMonthMqlTargets.map((mqlTotal, idx) => {
    const monthDate = new Date(global.fiscalYearStart);
    monthDate.setMonth(monthDate.getMonth() + idx);
    const iso = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth(),
      1
    ).toISOString();

    const paidShare = demand.mqlFromPaidPct / 100;
    const freeShare = demand.mqlFromFreePct / 100;
    const mqlPaid = mqlTotal * paidShare;
    const mqlFree = mqlTotal * freeShare;

    const opp =
      demand.mqlToOpportunityCr > 0
        ? mqlTotal * (demand.mqlToOpportunityCr / 100)
        : 0;
    const pipeline = opp * demand.averageDealSize;

    return {
      month: iso,
      mqlTotal,
      mqlPaid,
      mqlFree,
      opportunities: opp,
      pipeline
    };
  });

  const summary = {
    mqlInboundYear: mqlInbound,
    mqlPaidYear,
    mqlFreeYear,
    opportunitiesYear: oppInbound,
    pipelineYear: oppInbound * demand.averageDealSize
  };

  return {
    months: rows,
    summary
  };
}

