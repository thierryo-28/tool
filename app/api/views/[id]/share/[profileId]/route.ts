import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/server/supabaseAdmin';
import {
  getCurrentUserPrimaryEmail,
  getOrCreateProfileId,
  getWorkspaceRole,
  requireClerkUserId
} from '@/lib/server/viewsAuth';

interface PlannerViewRow {
  id: string;
  workspace_id: string;
  owner_profile_id: string;
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: { id: string; profileId: string } }
) {
  try {
    const clerkUserId = await requireClerkUserId();
    const email = await getCurrentUserPrimaryEmail();
    const profileId = await getOrCreateProfileId(clerkUserId, email);
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

    const { error } = await supabase
      .from('planner_view_shares')
      .delete()
      .eq('view_id', params.id)
      .eq('profile_id', params.profileId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to revoke share' }, { status: 500 });
  }
}
