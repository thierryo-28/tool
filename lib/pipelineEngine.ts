import { GlobalSettings, PipelineOutput, PipelineSettings } from './types';

function addWeeks(baseIsoDate: string, weeksToAdd: number): string {
  const date = new Date(baseIsoDate);
  date.setDate(date.getDate() + weeksToAdd * 7);
  // normalize to a stable day (day 1 doesn't matter for week buckets, but keep consistency)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
}

function buildWeekGrid(global: GlobalSettings): string[] {
  const weeksCount = global.months * 4; // MVP: 4 weeks per month buckets
  const weeks: string[] = [];
  for (let i = 0; i < weeksCount; i += 1) {
    weeks.push(addWeeks(global.fiscalYearStart, i));
  }
  return weeks;
}

function formatCrPercentToFactor(oppToWonCr: number): number {
  // expected input: 0..100
  if (!Number.isFinite(oppToWonCr) || oppToWonCr <= 0) return 0;
  return oppToWonCr / 100;
}

export function calculatePipelinePlan(
  global: GlobalSettings,
  pipeline: PipelineSettings
): PipelineOutput {
  const weeks = buildWeekGrid(global);
  const weeksCount = weeks.length;

  const inboundPct = Number.isFinite(pipeline.inboundRevenuePct)
    ? pipeline.inboundRevenuePct
    : 0;
  const outboundPct =
    Number.isFinite(pipeline.outboundRevenuePct) ? pipeline.outboundRevenuePct : 0;

  const inboundShare = inboundPct / 100;
  const outboundShare = outboundPct / 100;

  const dealExisting = Number.isFinite(pipeline.averageDealSizeExisting)
    ? pipeline.averageDealSizeExisting
    : 0;
  const dealNew = Number.isFinite(pipeline.averageDealSizeNew)
    ? pipeline.averageDealSizeNew
    : 0;
  const crExisting = formatCrPercentToFactor(pipeline.opportunityToWonCrExisting);
  const crNew = formatCrPercentToFactor(pipeline.opportunityToWonCrNew);

  const yearlyWonInboundExisting =
    pipeline.yearlyRevenueTargetExisting * inboundShare;
  const yearlyWonOutboundExisting =
    pipeline.yearlyRevenueTargetExisting * outboundShare;
  const yearlyWonInboundNew = pipeline.yearlyRevenueTargetNew * inboundShare;
  const yearlyWonOutboundNew =
    pipeline.yearlyRevenueTargetNew * outboundShare;

  // MVP: flat weekly weights for won revenue.
  const wonInboundExistingPerWeek =
    weeksCount > 0 ? yearlyWonInboundExisting / weeksCount : 0;
  const wonOutboundExistingPerWeek =
    weeksCount > 0 ? yearlyWonOutboundExisting / weeksCount : 0;
  const wonInboundNewPerWeek =
    weeksCount > 0 ? yearlyWonInboundNew / weeksCount : 0;
  const wonOutboundNewPerWeek =
    weeksCount > 0 ? yearlyWonOutboundNew / weeksCount : 0;

  const salesCycleLagWeeks = Math.max(0, Math.round(pipeline.salesCycleWeeks || 0));

  // Arrays represent won targets by week (index = won week).
  const wonInboundByWeek = Array(weeksCount).fill(
    wonInboundExistingPerWeek + wonInboundNewPerWeek
  );
  const wonOutboundByWeek = Array(weeksCount).fill(
    wonOutboundExistingPerWeek + wonOutboundNewPerWeek
  );

  const wonExistingByWeek = Array(weeksCount).fill(
    wonInboundExistingPerWeek + wonOutboundExistingPerWeek
  );
  const wonNewByWeek = Array(weeksCount).fill(
    wonInboundNewPerWeek + wonOutboundNewPerWeek
  );

  // We compute required pipeline creation by week (index = creation week).
  const pipelineInboundByCreationWeek = Array(weeksCount).fill(0);
  const pipelineOutboundByCreationWeek = Array(weeksCount).fill(0);
  const oppsInboundByCreationWeek = Array(weeksCount).fill(0);
  const oppsOutboundByCreationWeek = Array(weeksCount).fill(0);

  const pipelineExistingByCreationWeek = Array(weeksCount).fill(0);
  const pipelineNewByCreationWeek = Array(weeksCount).fill(0);
  const oppsExistingByCreationWeek = Array(weeksCount).fill(0);
  const oppsNewByCreationWeek = Array(weeksCount).fill(0);

  // For reconciliation / transparency: pre-year requirement (won in weeks < lag)
  // would require creation before week 0. We clamp it into week 0.
  const preYearWinningWeeks = Math.min(weeksCount, salesCycleLagWeeks);
  let preYearPipelineInbound = 0;
  let preYearPipelineOutbound = 0;

  for (let wonWeekIdx = 0; wonWeekIdx < weeksCount; wonWeekIdx += 1) {
    const creationIdxRaw = wonWeekIdx - salesCycleLagWeeks;
    const creationIdx = creationIdxRaw < 0 ? 0 : creationIdxRaw;

    // Won targets per segment (flat weekly weights for the MVP)
    const wonInExisting = wonInboundExistingPerWeek;
    const wonOutExisting = wonOutboundExistingPerWeek;
    const wonInNew = wonInboundNewPerWeek;
    const wonOutNew = wonOutboundNewPerWeek;

    // Existing business back-calc
    if (crExisting > 0) {
      const pipeInExisting = wonInExisting / crExisting;
      const pipeOutExisting = wonOutExisting / crExisting;
      pipelineInboundByCreationWeek[creationIdx] += pipeInExisting;
      pipelineOutboundByCreationWeek[creationIdx] += pipeOutExisting;
      pipelineExistingByCreationWeek[creationIdx] +=
        pipeInExisting + pipeOutExisting;

      if (dealExisting > 0) {
        oppsInboundByCreationWeek[creationIdx] += pipeInExisting / dealExisting;
        oppsOutboundByCreationWeek[creationIdx] += pipeOutExisting / dealExisting;
        oppsExistingByCreationWeek[creationIdx] +=
          pipeInExisting / dealExisting + pipeOutExisting / dealExisting;
      }
    }

    // New business back-calc
    if (crNew > 0) {
      const pipeInNew = wonInNew / crNew;
      const pipeOutNew = wonOutNew / crNew;
      pipelineInboundByCreationWeek[creationIdx] += pipeInNew;
      pipelineOutboundByCreationWeek[creationIdx] += pipeOutNew;
      pipelineNewByCreationWeek[creationIdx] += pipeInNew + pipeOutNew;

      if (dealNew > 0) {
        oppsInboundByCreationWeek[creationIdx] += pipeInNew / dealNew;
        oppsOutboundByCreationWeek[creationIdx] += pipeOutNew / dealNew;
        oppsNewByCreationWeek[creationIdx] +=
          pipeInNew / dealNew + pipeOutNew / dealNew;
      }
    }

    // Pre-year pipeline = portion of won target that references negative creation weeks.
    if (wonWeekIdx < preYearWinningWeeks) {
      if (crExisting > 0) {
        preYearPipelineInbound += wonInExisting / crExisting;
        preYearPipelineOutbound += wonOutExisting / crExisting;
      }
      if (crNew > 0) {
        preYearPipelineInbound += wonInNew / crNew;
        preYearPipelineOutbound += wonOutNew / crNew;
      }
    }
  }

  const weeksResult = weeks.map((weekIso, idx) => {
    const pipelineInbound = pipelineInboundByCreationWeek[idx];
    const pipelineOutbound = pipelineOutboundByCreationWeek[idx];
    const oppsInbound = oppsInboundByCreationWeek[idx];
    const oppsOutbound = oppsOutboundByCreationWeek[idx];
    const wonExisting = wonExistingByWeek[idx];
    const wonNew = wonNewByWeek[idx];
    const pipelineExisting = pipelineExistingByCreationWeek[idx];
    const pipelineNew = pipelineNewByCreationWeek[idx];
    const oppsExisting = oppsExistingByCreationWeek[idx];
    const oppsNew = oppsNewByCreationWeek[idx];
    const pipelineTotal = pipelineInbound + pipelineOutbound;
    const oppsTotal = oppsInbound + oppsOutbound;

    return {
      week: weekIso,
      wonInbound: wonInboundByWeek[idx],
      wonOutbound: wonOutboundByWeek[idx],
      pipelineInbound,
      pipelineOutbound,
      oppsInbound,
      oppsOutbound,
      wonExisting,
      wonNew,
      pipelineExisting,
      pipelineNew,
      oppsExisting,
      oppsNew,
      pipelineTotal,
      oppsTotal
    };
  });

  const pipelineInboundYear = pipelineInboundByCreationWeek.reduce(
    (a, b) => a + b,
    0
  );
  const pipelineOutboundYear = pipelineOutboundByCreationWeek.reduce(
    (a, b) => a + b,
    0
  );
  const oppsInboundYear = oppsInboundByCreationWeek.reduce((a, b) => a + b, 0);
  const oppsOutboundYear = oppsOutboundByCreationWeek.reduce((a, b) => a + b, 0);

  const pipelineExistingYear = pipelineExistingByCreationWeek.reduce(
    (a, b) => a + b,
    0
  );
  const pipelineNewYear = pipelineNewByCreationWeek.reduce(
    (a, b) => a + b,
    0
  );
  const oppsExistingYear = oppsExistingByCreationWeek.reduce((a, b) => a + b, 0);
  const oppsNewYear = oppsNewByCreationWeek.reduce((a, b) => a + b, 0);

  const wonInboundYear = wonInboundByWeek.reduce((a, b) => a + b, 0);
  const wonOutboundYear = wonOutboundByWeek.reduce((a, b) => a + b, 0);
  const wonExistingYear = wonExistingByWeek.reduce((a, b) => a + b, 0);
  const wonNewYear = wonNewByWeek.reduce((a, b) => a + b, 0);

  const summary = {
    wonInboundYear,
    wonOutboundYear,
    wonTotalYear: wonInboundYear + wonOutboundYear,
    pipelineInboundYear,
    pipelineOutboundYear,
    pipelineTotalYear: pipelineInboundYear + pipelineOutboundYear,
    oppsInboundYear,
    oppsOutboundYear,
    oppsTotalYear: oppsInboundYear + oppsOutboundYear,
    wonExistingYear,
    wonNewYear,
    pipelineExistingYear,
    pipelineNewYear,
    oppsExistingYear,
    oppsNewYear,
    preYearPipelineInbound,
    preYearPipelineOutbound
  };

  return { weeks: weeksResult, summary };
}

