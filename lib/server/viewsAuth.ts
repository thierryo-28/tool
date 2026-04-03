import { auth, currentUser } from '@clerk/nextjs/server';
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

export async function getCurrentUserPrimaryEmail(): Promise<string | null> {
  const user = await currentUser();
  if (!user) return null;
  const primaryId = user.primaryEmailAddressId;
  if (!primaryId) return null;
  const match = user.emailAddresses.find((e) => e.id === primaryId);
  return match?.emailAddress ?? null;
}

async function finalizePendingInvites(profileId: string, email: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;

  const { data: invites, error: invitesErr } = await supabase
    .from('workspace_invites')
    .select('id, workspace_id, role')
    .eq('status', 'pending')
    .ilike('email', normalized);
  if (invitesErr) throw invitesErr;
  if (!invites || invites.length === 0) return;

  const memberships = invites.map((inv) => ({
    workspace_id: inv.workspace_id as string,
    profile_id: profileId,
    role: inv.role as WorkspaceRole
  }));

  const { error: membershipErr } = await supabase
    .from('workspace_memberships')
    .upsert(memberships, { onConflict: 'workspace_id,profile_id' });
  if (membershipErr) throw membershipErr;

  const inviteIds = invites.map((inv) => inv.id as string);
  const { error: updateErr } = await supabase
    .from('workspace_invites')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .in('id', inviteIds);
  if (updateErr) throw updateErr;
}

export async function getOrCreateProfileId(
  clerkUserId: string,
  email?: string | null
): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const { data: existing, error: existingErr } = await supabase
    .from('profiles')
    .select('id, clerk_user_id')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle<ProfileRow>();
  if (existingErr) throw existingErr;
  if (existing?.id) {
    if (email) {
      await finalizePendingInvites(existing.id, email);
    }
    return existing.id;
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('profiles')
    .insert({ clerk_user_id: clerkUserId, email: email ?? null })
    .select('id')
    .single<{ id: string }>();
  if (insertErr) throw insertErr;
  if (email) {
    await finalizePendingInvites(inserted.id, email);
  }
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
