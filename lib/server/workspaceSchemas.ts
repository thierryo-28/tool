import { z } from 'zod';

export const workspaceRoleSchema = z.enum(['admin', 'user', 'viewer']);

export const addMemberSchema = z.object({
  clerkUserId: z.string().min(1),
  role: workspaceRoleSchema
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: workspaceRoleSchema
});

export const updateMemberRoleSchema = z.object({
  profileId: z.string().uuid(),
  role: workspaceRoleSchema
});

export const setActiveWorkspaceSchema = z.object({
  activeWorkspaceId: z.string().uuid()
});
