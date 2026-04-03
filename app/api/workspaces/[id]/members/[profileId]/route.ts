import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/server/supabaseAdmin';
import {
  getCurrentUserPrimaryEmail,
  getOrCreateProfileId,
  getWorkspaceRole,
  requireClerkUserId
} from '@/lib/server/viewsAuth';
import { updateMemberRoleSchema } from '@/lib/server/workspaceSchemas';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; profileId: string } }
) {
  try {
    const parsed = updateMemberRoleSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    if (parsed.data.profileId !== params.profileId) {
      return NextResponse.json(
        { error: 'Path and body profile id mismatch' },
        { status: 400 }
      );
    }

    const clerkUserId = await requireClerkUserId();
    const email = await getCurrentUserPrimaryEmail();
    const profileId = await getOrCreateProfileId(clerkUserId, email);
    const role = await getWorkspaceRole(params.id, profileId);
    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can update roles' },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from('workspace_memberships')
      .update({ role: parsed.data.role })
      .eq('workspace_id', params.id)
      .eq('profile_id', params.profileId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to update member role' },
      { status: 500 }
    );
  }
}
