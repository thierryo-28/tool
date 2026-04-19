import { z } from 'zod';
import { normalizeSdrViewPayload } from '@/lib/plannerViewPayloads';

const IsoDateString = z.string().min(10);
const NonNegative = z.number().min(0);

/** Month inputs often send `YYYY-MM`; normalize before enforcing min length. */
function normalizeWaveStartDateInput(val: unknown): unknown {
  if (typeof val !== 'string') return val;
  if (/^\d{4}-\d{2}$/.test(val)) {
    return `${val}-01T12:00:00.000Z`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return `${val}T12:00:00.000Z`;
  }
  return val;
}

const waveStartDateSchema = z.preprocess(
  normalizeWaveStartDateInput,
  z.string().min(10)
);

const seasonalitySchema = z.object({
  quarterWeightsPct: z.tuple([NonNegative, NonNegative, NonNegative, NonNegative]),
  withinQuarterPct: z.tuple([NonNegative, NonNegative, NonNegative])
});

const globalSettingsSchema = z.object({
  fiscalYearStart: IsoDateString,
  months: z.number().int().min(1).max(24),
  companyTargetAnnual: NonNegative,
  overAssignmentPct: z.number().min(0).max(2),
  seasonality: seasonalitySchema
});

const plannerGlobalsSchema = z.object({
  fiscalYearStart: IsoDateString,
  months: z.number().int().min(1).max(24),
  seasonality: seasonalitySchema
});

const capacityRoleIdSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/);

const roleAssumptionSchema = z.object({
  id: capacityRoleIdSchema,
  name: z.string().min(1),
  annualQuota: NonNegative,
  rampMonths: z.number().int().min(1).max(12),
  rampPattern: z.array(z.number().min(0).max(1.5)).max(12),
  annualAttritionPct: z.number().min(0).max(1)
});

const capacityPayloadSchema = z
  .object({
    kind: z.literal('capacity'),
    settings: globalSettingsSchema,
    roles: z.array(roleAssumptionSchema).min(1).max(6),
    waves: z.array(
      z.object({
        roleId: capacityRoleIdSchema,
        count: z.number().int().min(0),
        startDate: waveStartDateSchema
      })
    ),
    baseline: z.record(capacityRoleIdSchema, z.number().int().min(0)),
    selectedRoles: z.record(capacityRoleIdSchema, z.boolean()),
    showResults: z.boolean().default(false)
  })
  .superRefine((val, ctx) => {
    const ids = val.roles.map((r) => r.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duplicate role id',
        path: ['roles']
      });
    }
    val.waves.forEach((w, i) => {
      if (!ids.includes(w.roleId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'wave.roleId must match a role id',
          path: ['waves', i, 'roleId']
        });
      }
    });
    Object.keys(val.baseline).forEach((k) => {
      if (!ids.includes(k)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'baseline key must match a role id',
          path: ['baseline', k]
        });
      }
    });
    Object.keys(val.selectedRoles).forEach((k) => {
      if (!ids.includes(k)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'selectedRoles key must match a role id',
          path: ['selectedRoles', k]
        });
      }
    });
    ids.forEach((id) => {
      if (!(id in val.selectedRoles)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `selectedRoles missing entry for role id ${id}`,
          path: ['selectedRoles']
        });
      }
    });
  });

const sdrRoleSchema = z.object({
  id: z.string().min(1).max(32),
  name: z.string().min(1),
  annualQuota: NonNegative,
  rampMonths: z.number().int().min(1).max(12),
  rampPattern: z.array(z.number().min(0).max(1.5)).max(12),
  annualAttritionPct: z.number().min(0).max(1)
});

const sdrWaveFlexSchema = z.object({
  roleId: z.string().min(1).max(32).optional(),
  count: z.number().int().min(0),
  startDate: waveStartDateSchema
});

const sdrPayloadSchema = z
  .object({
    kind: z.literal('sdr'),
    settings: globalSettingsSchema,
    sdrRole: sdrRoleSchema.optional(),
    sdrRoles: z.array(sdrRoleSchema).max(3).optional(),
    sdrWaves: z.array(sdrWaveFlexSchema),
    sdrBaseline: z.number().int().min(0).optional(),
    sdrBaselines: z.record(z.string(), z.number().int().min(0)).optional(),
    sdrPipeline: z
      .object({
        sqlToOpportunityPct: z.number().min(0).max(100),
        averageOpportunitySize: NonNegative,
        opportunityToWonPct: z.number().min(0).max(100),
        salesCycleWeeks: NonNegative
      })
      .optional(),
    showResults: z.boolean().default(false)
  })
  .superRefine((val, ctx) => {
    const multiLen = val.sdrRoles?.length ?? 0;
    const hasLegacy = val.sdrRole !== undefined;
    if (multiLen === 0 && !hasLegacy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide sdrRole or sdrRoles',
        path: ['sdrRole']
      });
    }
    if (multiLen > 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At most 3 SDR roles',
        path: ['sdrRoles']
      });
    }
  })
  .transform((val) => normalizeSdrViewPayload(val as Record<string, unknown>));

const demandPayloadSchema = z.object({
  kind: z.literal('demand'),
  globals: plannerGlobalsSchema,
  demandSettings: z.object({
    yearlyPaidMediaBudget: NonNegative,
    mqlFromPaidPct: z.number().min(0).max(100),
    mqlFromFreePct: z.number().min(0).max(100),
    targetCpl: NonNegative,
    mqlToOpportunityCr: z.number().min(0).max(100),
    opportunityToWonCr: z.number().min(0).max(100),
    yearlyRevenueTarget: NonNegative,
    inboundRevenuePct: z.number().min(0).max(100),
    outboundRevenuePct: z.number().min(0).max(100),
    averageDealSize: NonNegative
  })
});

const pipelinePayloadSchema = z.object({
  kind: z.literal('pipeline'),
  globals: plannerGlobalsSchema,
  pipelineSettings: z.object({
    yearlyRevenueTargetExisting: NonNegative,
    yearlyRevenueTargetNew: NonNegative,
    inboundRevenuePct: z.number().min(0).max(100),
    outboundRevenuePct: z.number().min(0).max(100),
    opportunityToWonCrExisting: z.number().min(0).max(100),
    opportunityToWonCrNew: z.number().min(0).max(100),
    averageDealSizeExisting: NonNegative,
    averageDealSizeNew: NonNegative,
    salesCycleWeeks: z.number().int().min(0).max(104)
  })
});

export const tabViewPayloadSchema = z.union([
  capacityPayloadSchema,
  sdrPayloadSchema,
  demandPayloadSchema,
  pipelinePayloadSchema
]);

export const plannerTabSchema = z.enum(['capacity', 'sdr', 'demand', 'pipeline']);

export const saveViewRequestSchema = z
  .object({
    workspaceId: z.string().uuid(),
    tab: plannerTabSchema,
    name: z.string().trim().min(1).max(80),
    payload: tabViewPayloadSchema,
    isPublicInWorkspace: z.boolean().optional().default(false)
  })
  .superRefine((v, ctx) => {
    if (v.payload.kind !== v.tab) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payload', 'kind'],
        message: 'payload.kind must match tab'
      });
    }
  });

export const updateViewRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    payload: tabViewPayloadSchema.optional(),
    isPublicInWorkspace: z.boolean().optional()
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.payload !== undefined ||
      v.isPublicInWorkspace !== undefined,
    {
      message: 'At least one field is required'
    }
  );

export const shareViewRequestSchema = z.object({
  profileId: z.string().uuid(),
  permission: z.enum(['viewer', 'editor'])
});
