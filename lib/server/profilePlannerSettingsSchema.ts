import { z } from 'zod';
import {
  MAX_SDR_TEMPLATE_ROLES,
  MAX_SALES_TEMPLATE_ROLES,
  PROFILE_PLANNER_SETTINGS_VERSION
} from '@/lib/profilePlannerSettings';

const NonNegative = z.number().min(0);

const salesTemplateRowSchema = z.object({
  title: z.string().trim().min(1).max(120),
  rampMonths: z.number().int().min(1).max(12),
  defaultAnnualQuota: NonNegative
});

const sdrTemplateRowSchema = z.object({
  title: z.string().trim().min(1).max(120),
  rampMonths: z.number().int().min(1).max(12),
  defaultAnnualSqlQuota: NonNegative
});

export const profilePlannerSettingsBodySchema = z.object({
  version: z.literal(PROFILE_PLANNER_SETTINGS_VERSION),
  salesTemplates: z.array(salesTemplateRowSchema).max(MAX_SALES_TEMPLATE_ROLES),
  sdrTemplates: z.array(sdrTemplateRowSchema).max(MAX_SDR_TEMPLATE_ROLES)
});

export type ProfilePlannerSettingsBody = z.infer<
  typeof profilePlannerSettingsBodySchema
>;
