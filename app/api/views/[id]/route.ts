import { NextRequest, NextResponse } from 'next/server';
import type { SavedViewRecord } from '@/lib/savedViews';
import { getSupabaseAdminClient } from '@/lib/server/supabaseAdmin';
import {
  getCurrentUserPrimaryEmail,
  getOrCreateProfileId,
  getWorkspaceRole,
  requireClerkUserId
} from '@/lib/server/viewsAuth';
import { updateViewRequestSchema } from '@/lib/server/viewsSchemas';

interface PlannerViewRow {
  id: string;
  workspace_id: string;
  owner_profile_id: string;
  tab: SavedViewRecord['tab'];
  name: string;
  payload: SavedViewRecord['payload'];
  updated_at: string;
}

function toSavedViewRecord(row: PlannerViewRow): SavedViewRecord {
  return {
    id: row.id,
    name: row.name,
    tab: row.tab,
    updatedAt: row.updated_at,
    payload: row.payload
  };
}

async function getAuthorizedView(id: string) {
  const clerkUserId = await requireClerkUserId();
  const email = await getCurrentUserPrimaryEmail();
  const profileId = await getOrCreateProfileId(clerkUserId, email);
  const supabase = getSupabaseAdminClient();

  const { data: row, error: rowErr } = await supabase
    .from('planner_views')
    .select('id, workspace_id, owner_profile_id, tab, name, payload, updated_at')
    .eq('id', id)
    .maybeSingle<PlannerViewRow>();
  if (rowErr) throw rowErr;
  if (!row) return { status: 404 as const };

  const role = await getWorkspaceRole(row.workspace_id, profileId);
  if (!role) return { status: 403 as const };

  const { data: share } = await supabase
    .from('planner_view_shares')
    .select('permission')
    .eq('view_id', id)
    .eq('profile_id', profileId)
    .maybeSingle<{ permission: 'viewer' | 'editor' }>();

  const canRead =
    role === 'admin' ||
    row.owner_profile_id === profileId ||
    !!share ||
    false;
  const canWrite =
    role === 'admin' ||
    row.owner_profile_id === profileId ||
    share?.permission === 'editor';

  return { status: 200 as const, row, canRead, canWrite };
}

export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authz = await getAuthorizedView(params.id);
    if (authz.status !== 200) {
      return NextResponse.json({ error: 'Not found' }, { status: authz.status });
    }
    if (!authz.canRead) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ view: toSavedViewRecord(authz.row) });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load view' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const parsed = updateViewRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const authz = await getAuthorizedView(params.id);
    if (authz.status !== 200) {
      return NextResponse.json({ error: 'Not found' }, { status: authz.status });
    }
    if (!authz.canWrite) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const patch: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.payload !== undefined) patch.payload = parsed.data.payload;
    if (parsed.data.isPublicInWorkspace !== undefined) {
      patch.is_public_in_workspace = parsed.data.isPublicInWorkspace;
    }

    const supabase = getSupabaseAdminClient();
    const { data: updated, error: updateErr } = await supabase
      .from('planner_views')
      .update(patch)
      .eq('id', params.id)
      .select('id, workspace_id, owner_profile_id, tab, name, payload, updated_at')
      .single<PlannerViewRow>();
    if (updateErr) throw updateErr;

    return NextResponse.json({ view: toSavedViewRecord(updated) });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update view' }, { status: 500 });
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authz = await getAuthorizedView(params.id);
    if (authz.status !== 200) {
      return NextResponse.json({ error: 'Not found' }, { status: authz.status });
    }
    if (!authz.canWrite) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from('planner_views').delete().eq('id', params.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to delete view' }, { status: 500 });
  }
}
