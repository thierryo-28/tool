import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/server/supabaseAdmin';
import {
  getCurrentUserPrimaryEmail,
  getOrCreateProfileId,
  getWorkspaceRole,
  requireClerkUserId
} from '@/lib/server/viewsAuth';
import { inviteMemberSchema } from '@/lib/server/workspaceSchemas';

interface InviteRow {
  id: string;
  workspace_id: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  status: string;
  created_at: string;
}

async function createClerkInvitation(email: string): Promise<string> {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) {
    throw new Error('Missing CLERK_SECRET_KEY');
  }
  const res = await fetch('https://api.clerk.com/v1/invitations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email_address: email
    })
  });
  const json = (await res.json()) as { id?: string; errors?: { message?: string }[] };
  if (!res.ok || !json.id) {
    const message = json.errors?.[0]?.message ?? 'Could not create Clerk invitation';
    throw new Error(message);
  }
  return json.id;
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
      .from('workspace_invites')
      .select('id, workspace_id, email, role, status, created_at')
      .eq('workspace_id', params.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .returns<InviteRow[]>();
    if (error) throw error;

    return NextResponse.json({
      invites: (data ?? []).map((i) => ({
        id: i.id,
        workspaceId: i.workspace_id,
        email: i.email,
        role: i.role,
        status: i.status,
        createdAt: i.created_at
      }))
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to list invites' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const parsed = inviteMemberSchema.safeParse(await req.json());
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
        { error: 'Only admins can invite members' },
        { status: 403 }
      );
    }

    const normalizedEmail = parsed.data.email.toLowerCase();
    const invitationId = await createClerkInvitation(normalizedEmail);
    const supabase = getSupabaseAdminClient();
    const { data: existingPending, error: existingErr } = await supabase
      .from('workspace_invites')
      .select('id')
      .eq('workspace_id', params.id)
      .eq('status', 'pending')
      .ilike('email', normalizedEmail)
      .maybeSingle<{ id: string }>();
    if (existingErr) throw existingErr;

    if (existingPending?.id) {
      const { error: updateErr } = await supabase
        .from('workspace_invites')
        .update({
          role: parsed.data.role,
          clerk_invitation_id: invitationId,
          invited_by_profile_id: profileId
        })
        .eq('id', existingPending.id);
      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await supabase.from('workspace_invites').insert({
        workspace_id: params.id,
        email: normalizedEmail,
        role: parsed.data.role,
        clerk_invitation_id: invitationId,
        invited_by_profile_id: profileId,
        status: 'pending',
        accepted_at: null
      });
      if (insertErr) throw insertErr;
    }

    return NextResponse.json({ ok: true, invitationId });
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create invite' },
      { status: 500 }
    );
  }
}
