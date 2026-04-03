import { z } from 'zod';

const IsoDateString = z.string().min(10);
const NonNegative = z.number().min(0);

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

const roleIdSchema = z.enum(['AE', 'AM']);

const roleAssumptionSchema = z.object({
  id: roleIdSchema,
  name: z.string().min(1),
  annualQuota: NonNegative,
  rampMonths: z.number().int().min(1).max(12),
  rampPattern: z.array(z.number().min(0).max(1.5)).max(12),
  annualAttritionPct: z.number().min(0).max(1)
});

const capacityPayloadSchema = z.object({
  kind: z.literal('capacity'),
  settings: globalSettingsSchema,
  roles: z.array(roleAssumptionSchema),
  waves: z.array(
    z.object({
      roleId: roleIdSchema,
      count: z.number().int().min(0),
      startDate: IsoDateString
    })
  ),
  baseline: z.object({
    AE: z.number().int().min(0),
    AM: z.number().int().min(0)
  }),
  selectedRoles: z.object({
    AE: z.boolean(),
    AM: z.boolean()
  }),
  showResults: z.boolean()
});

const sdrPayloadSchema = z.object({
  kind: z.literal('sdr'),
  settings: globalSettingsSchema,
  sdrRole: z.object({
    id: z.literal('SDR'),
    name: z.string().min(1),
    annualQuota: NonNegative,
    rampMonths: z.number().int().min(1).max(12),
    rampPattern: z.array(z.number().min(0).max(1.5)).max(12),
    annualAttritionPct: z.number().min(0).max(1)
  }),
  sdrWaves: z.array(
    z.object({
      count: z.number().int().min(0),
      startDate: IsoDateString
    })
  ),
  sdrBaseline: z.number().int().min(0),
  showResults: z.boolean()
});

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

export const tabViewPayloadSchema = z.discriminatedUnion('kind', [
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
