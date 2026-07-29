import { getSupabaseAdminClient } from './supabaseAdmin';
import type { WorkspaceRole } from './viewsAuth';

export interface WorkspaceMembershipSummary {
  id: string;
  name: string;
  role: WorkspaceRole;
}

interface MembershipRow {
  workspace_id: string;
  role: WorkspaceRole;
  workspaces: { id: string; name: string } | null;
}

interface ProfilePreferencesRow {
  active_workspace_id: string | null;
}

const PLACEHOLDER_WORKSPACE_ID = '00000000-0000-0000-0000-000000000000';

/** Legacy override; phase C will use profile_preferences.active_workspace_id instead. */
export function getConfiguredDefaultWorkspaceId(): string | null {
  const id = process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID?.trim();
  if (!id || id === PLACEHOLDER_WORKSPACE_ID) return null;
  return id;
}

async function listMemberships(
  profileId: string
): Promise<WorkspaceMembershipSummary[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('workspace_memberships')
    .select('workspace_id, role, workspaces:workspace_id (id, name)')
    .eq('profile_id', profileId)
    .returns<MembershipRow[]>();
  if (error) throw error;

  return (data ?? [])
    .map((row) => ({
      id: row.workspaces?.id ?? row.workspace_id,
      name: row.workspaces?.name ?? 'Workspace',
      role: row.role
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function countWorkspaces(): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase
    .from('workspaces')
    .select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

async function countWorkspaceMembers(workspaceId: string): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase
    .from('workspace_memberships')
    .select('profile_id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);
  if (error) throw error;
  return count ?? 0;
}

async function workspaceExists(workspaceId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  return !!data?.id;
}

async function addMembership(
  workspaceId: string,
  profileId: string,
  role: WorkspaceRole
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('workspace_memberships').upsert(
    {
      workspace_id: workspaceId,
      profile_id: profileId,
      role
    },
    { onConflict: 'workspace_id,profile_id' }
  );
  if (error) throw error;
}

async function createWorkspaceWithAdmin(
  profileId: string,
  name: string
): Promise<WorkspaceMembershipSummary> {
  const supabase = getSupabaseAdminClient();
  const { data: workspace, error: workspaceErr } = await supabase
    .from('workspaces')
    .insert({
      name,
      created_by_profile_id: profileId
    })
    .select('id, name')
    .single<{ id: string; name: string }>();
  if (workspaceErr) throw workspaceErr;

  await addMembership(workspace.id, profileId, 'admin');

  return {
    id: workspace.id,
    name: workspace.name,
    role: 'admin'
  };
}

/**
 * Alternative A: first global sign-in creates the team workspace; later users join via invite.
 * Phase C extension: add POST /api/workspaces so any member can create additional workspaces.
 */
export async function bootstrapWorkspaceMembershipIfNeeded(
  profileId: string,
  email?: string | null
): Promise<WorkspaceMembershipSummary | null> {
  const existing = await listMemberships(profileId);
  if (existing.length > 0) return null;

  const configuredId = getConfiguredDefaultWorkspaceId();
  if (configuredId && (await workspaceExists(configuredId))) {
    const memberCount = await countWorkspaceMembers(configuredId);
    if (memberCount === 0) {
      await addMembership(configuredId, profileId, 'admin');
      const refreshed = await listMemberships(profileId);
      return refreshed.find((m) => m.id === configuredId) ?? null;
    }
    return null;
  }

  const totalWorkspaces = await countWorkspaces();
  if (totalWorkspaces > 0) {
    return null;
  }

  const label =
    email?.trim() ?
      `${email.trim().split('@')[0] ?? 'Team'} workspace`
    : 'Default workspace';

  return createWorkspaceWithAdmin(profileId, label);
}

export async function listUserWorkspaces(
  profileId: string
): Promise<WorkspaceMembershipSummary[]> {
  return listMemberships(profileId);
}

async function getStoredActiveWorkspaceId(
  profileId: string
): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('profile_preferences')
    .select('active_workspace_id')
    .eq('profile_id', profileId)
    .maybeSingle<ProfilePreferencesRow>();
  if (error) throw error;
  return data?.active_workspace_id ?? null;
}

export async function setActiveWorkspaceId(
  profileId: string,
  workspaceId: string
): Promise<void> {
  const memberships = await listMemberships(profileId);
  if (!memberships.some((m) => m.id === workspaceId)) {
    throw new Error('FORBIDDEN_WORKSPACE');
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('profile_preferences').upsert(
    {
      profile_id: profileId,
      active_workspace_id: workspaceId,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'profile_id' }
  );
  if (error) throw error;
}

/**
 * Resolve which workspace the client should use.
 * Priority: explicit request > stored preference > legacy env default > sole membership > first membership.
 */
export async function resolveActiveWorkspace(
  profileId: string,
  requestedWorkspaceId?: string | null
): Promise<{
  workspaces: WorkspaceMembershipSummary[];
  activeWorkspaceId: string | null;
  activeRole: WorkspaceRole | null;
}> {
  const workspaces = await listMemberships(profileId);
  if (workspaces.length === 0) {
    return { workspaces, activeWorkspaceId: null, activeRole: null };
  }

  const membershipIds = new Set(workspaces.map((w) => w.id));
  const storedId = await getStoredActiveWorkspaceId(profileId);
  const configuredId = getConfiguredDefaultWorkspaceId();

  const candidates = [
    requestedWorkspaceId,
    storedId,
    configuredId && membershipIds.has(configuredId) ? configuredId : null,
    workspaces.length === 1 ? workspaces[0].id : null,
    workspaces[0]?.id ?? null
  ].filter((id): id is string => !!id && membershipIds.has(id));

  const activeWorkspaceId = candidates[0] ?? null;
  const active = workspaces.find((w) => w.id === activeWorkspaceId);

  return {
    workspaces,
    activeWorkspaceId,
    activeRole: active?.role ?? null
  };
}
