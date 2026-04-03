import { NextRequest, NextResponse } from 'next/server';
import type { SavedViewRecord } from '@/lib/savedViews';
import { getSupabaseAdminClient } from '@/lib/server/supabaseAdmin';
import {
  canEditByRole,
  getCurrentUserPrimaryEmail,
  getOrCreateProfileId,
  getWorkspaceRole,
  requireClerkUserId
} from '@/lib/server/viewsAuth';
import {
  plannerTabSchema,
  saveViewRequestSchema
} from '@/lib/server/viewsSchemas';

interface PlannerViewRow {
  id: string;
  workspace_id: string;
  owner_profile_id: string;
  tab: SavedViewRecord['tab'];
  name: string;
  payload: SavedViewRecord['payload'];
  updated_at: string;
  is_public_in_workspace: boolean;
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

export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get('workspaceId');
    const tabRaw = req.nextUrl.searchParams.get('tab');
    if (!workspaceId || !tabRaw) {
      return NextResponse.json(
        { error: 'workspaceId and tab are required' },
        { status: 400 }
      );
    }

    const tabResult = plannerTabSchema.safeParse(tabRaw);
    if (!tabResult.success) {
      return NextResponse.json({ error: 'Invalid tab' }, { status: 400 });
    }

    const clerkUserId = await requireClerkUserId();
    const email = await getCurrentUserPrimaryEmail();
    const profileId = await getOrCreateProfileId(clerkUserId, email);
    const role = await getWorkspaceRole(workspaceId, profileId);
    if (!role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: allRows, error: rowsErr } = await supabase
      .from('planner_views')
      .select(
        'id, workspace_id, owner_profile_id, tab, name, payload, updated_at, is_public_in_workspace'
      )
      .eq('workspace_id', workspaceId)
      .eq('tab', tabResult.data);
    if (rowsErr) throw rowsErr;

    const { data: shares, error: sharesErr } = await supabase
      .from('planner_view_shares')
      .select('view_id')
      .eq('profile_id', profileId);
    if (sharesErr) throw sharesErr;
    const sharedIds = new Set((shares ?? []).map((s) => s.view_id as string));

    const visible = (allRows as PlannerViewRow[]).filter((row) => {
      if (row.owner_profile_id === profileId) return true;
      if (row.is_public_in_workspace) return true;
      if (sharedIds.has(row.id)) return true;
      if (role === 'admin') return true;
      return false;
    });

    const views = visible
      .map(toSavedViewRecord)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return NextResponse.json({ views });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to list views' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = saveViewRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const clerkUserId = await requireClerkUserId();
    const email = await getCurrentUserPrimaryEmail();
    const profileId = await getOrCreateProfileId(clerkUserId, email);
    const role = await getWorkspaceRole(parsed.data.workspaceId, profileId);
    if (!role || !canEditByRole(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getSupabaseAdminClient();

    const { data: existing, error: existingErr } = await supabase
      .from('planner_views')
      .select(
        'id, workspace_id, owner_profile_id, tab, name, payload, updated_at, is_public_in_workspace'
      )
      .eq('workspace_id', parsed.data.workspaceId)
      .eq('tab', parsed.data.tab)
      .ilike('name', parsed.data.name)
      .maybeSingle<PlannerViewRow>();
    if (existingErr) throw existingErr;

    if (existing) {
      const canUpdate =
        role === 'admin' || existing.owner_profile_id === profileId;
      if (!canUpdate) {
        return NextResponse.json(
          { error: 'Only owner/admin can overwrite this named view.' },
          { status: 403 }
        );
      }
      const { data: updated, error: updateErr } = await supabase
        .from('planner_views')
        .update({
          payload: parsed.data.payload,
          is_public_in_workspace: parsed.data.isPublicInWorkspace
        })
        .eq('id', existing.id)
        .select(
          'id, workspace_id, owner_profile_id, tab, name, payload, updated_at, is_public_in_workspace'
        )
        .single<PlannerViewRow>();
      if (updateErr) throw updateErr;
      return NextResponse.json({ view: toSavedViewRecord(updated) });
    }

    const { data: created, error: createErr } = await supabase
      .from('planner_views')
      .insert({
        workspace_id: parsed.data.workspaceId,
        owner_profile_id: profileId,
        tab: parsed.data.tab,
        name: parsed.data.name,
        payload: parsed.data.payload,
        is_public_in_workspace: parsed.data.isPublicInWorkspace ?? false
      })
      .select(
        'id, workspace_id, owner_profile_id, tab, name, payload, updated_at, is_public_in_workspace'
      )
      .single<PlannerViewRow>();
    if (createErr) throw createErr;

    return NextResponse.json({ view: toSavedViewRecord(created) });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to save view' }, { status: 500 });
  }
}
