import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdminClient } from '@/lib/server/supabaseAdmin';
import { getWorkspaceRole } from '@/lib/server/viewsAuth';

const noStoreHeaders = {
  'Cache-Control':
    'private, no-store, no-cache, must-revalidate, max-age=0',
  Vary: 'Cookie'
} as const;

function jsonRole(role: string | null) {
  return NextResponse.json({ role }, { headers: noStoreHeaders });
}

export async function GET(
  _: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return jsonRole(null);
    }

    const supabase = getSupabaseAdminClient();
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('clerk_user_id', userId)
      .maybeSingle<{ id: string }>();
    if (profileErr) throw profileErr;
    if (!profile?.id) {
      return jsonRole(null);
    }

    const role = await getWorkspaceRole(params.id, profile.id);

    return jsonRole(role);
  } catch {
    return jsonRole(null);
  }
}
