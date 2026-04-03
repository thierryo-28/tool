import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/server/supabaseAdmin';
import {
  getOrCreateProfileId,
  getWorkspaceRole,
  requireClerkUserId
} from '@/lib/server/viewsAuth';
import { shareViewRequestSchema } from '@/lib/server/viewsSchemas';

interface PlannerViewRow {
  id: string;
  workspace_id: string;
  owner_profile_id: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const parsed = shareViewRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const clerkUserId = await requireClerkUserId();
    const profileId = await getOrCreateProfileId(clerkUserId);
    const supabase = getSupabaseAdminClient();

    const { data: row, error: rowErr } = await supabase
      .from('planner_views')
      .select('id, workspace_id, owner_profile_id')
      .eq('id', params.id)
      .maybeSingle<PlannerViewRow>();
    if (rowErr) throw rowErr;
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const role = await getWorkspaceRole(row.workspace_id, profileId);
    if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const canShare = role === 'admin' || row.owner_profile_id === profileId;
    if (!canShare) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabase.from('planner_view_shares').upsert(
      {
        view_id: params.id,
        profile_id: parsed.data.profileId,
        permission: parsed.data.permission
      },
      {
        onConflict: 'view_id,profile_id'
      }
    );
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to share view' }, { status: 500 });
  }
}
