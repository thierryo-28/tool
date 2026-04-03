import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdminClient } from './supabaseAdmin';

export type WorkspaceRole = 'admin' | 'user' | 'viewer';

interface ProfileRow {
  id: string;
  clerk_user_id: string;
}

interface MembershipRow {
  workspace_id: string;
  profile_id: string;
  role: WorkspaceRole;
}

export async function requireClerkUserId(): Promise<string> {
  const { userId } = auth();
  if (!userId) {
    throw new Error('UNAUTHORIZED');
  }
  return userId;
}

export async function getOrCreateProfileId(clerkUserId: string): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const { data: existing, error: existingErr } = await supabase
    .from('profiles')
    .select('id, clerk_user_id')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle<ProfileRow>();
  if (existingErr) throw existingErr;
  if (existing?.id) return existing.id;

  const { data: inserted, error: insertErr } = await supabase
    .from('profiles')
    .insert({ clerk_user_id: clerkUserId })
    .select('id')
    .single<{ id: string }>();
  if (insertErr) throw insertErr;
  return inserted.id;
}

export async function getWorkspaceRole(
  workspaceId: string,
  profileId: string
): Promise<WorkspaceRole | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('workspace_memberships')
    .select('workspace_id, profile_id, role')
    .eq('workspace_id', workspaceId)
    .eq('profile_id', profileId)
    .maybeSingle<MembershipRow>();
  if (error) throw error;
  return data?.role ?? null;
}

export function canEditByRole(role: WorkspaceRole): boolean {
  return role === 'admin' || role === 'user';
}
