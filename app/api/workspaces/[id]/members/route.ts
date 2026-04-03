import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/server/supabaseAdmin';
import {
  getCurrentUserPrimaryEmail,
  getOrCreateProfileId,
  getWorkspaceRole,
  requireClerkUserId
} from '@/lib/server/viewsAuth';
import { addMemberSchema } from '@/lib/server/workspaceSchemas';

interface MembershipRow {
  workspace_id: string;
  profile_id: string;
  role: 'admin' | 'user' | 'viewer';
  profiles: {
    clerk_user_id: string;
    email: string | null;
    full_name: string | null;
  } | null;
}

export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clerkUserId = await requireClerkUserId();
    const email = await getCurrentUserPrimaryEmail();
    const profileId = await getOrCreateProfileId(clerkUserId, email);
    const role = await getWorkspaceRole(params.id, profileId);
    if (!role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('workspace_memberships')
      .select(
        'workspace_id, profile_id, role, profiles:profile_id (clerk_user_id, email, full_name)'
      )
      .eq('workspace_id', params.id)
      .returns<MembershipRow[]>();
    if (error) throw error;

    return NextResponse.json({
      members: (data ?? []).map((m) => ({
        workspaceId: m.workspace_id,
        profileId: m.profile_id,
        role: m.role,
        clerkUserId: m.profiles?.clerk_user_id ?? '',
        email: m.profiles?.email ?? null,
        fullName: m.profiles?.full_name ?? null
      }))
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to list workspace members' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const parsed = addMemberSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const clerkUserId = await requireClerkUserId();
    const email = await getCurrentUserPrimaryEmail();
    const profileId = await getOrCreateProfileId(clerkUserId, email);
    const role = await getWorkspaceRole(params.id, profileId);
    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can add members' },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdminClient();

    const { data: target, error: targetErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('clerk_user_id', parsed.data.clerkUserId)
      .maybeSingle<{ id: string }>();
    if (targetErr) throw targetErr;
    if (!target) {
      return NextResponse.json(
        {
          error:
            'Target Clerk user does not exist in profiles yet. Ask them to sign in once first.'
        },
        { status: 400 }
      );
    }

    const { error } = await supabase.from('workspace_memberships').upsert(
      {
        workspace_id: params.id,
        profile_id: target.id,
        role: parsed.data.role
      },
      { onConflict: 'workspace_id,profile_id' }
    );
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
  }
}
