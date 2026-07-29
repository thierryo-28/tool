import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentUserPrimaryEmail,
  getOrCreateProfileId,
  requireClerkUserId
} from '@/lib/server/viewsAuth';
import {
  bootstrapWorkspaceMembershipIfNeeded,
  resolveActiveWorkspace,
  setActiveWorkspaceId
} from '@/lib/server/workspaceService';
import { setActiveWorkspaceSchema } from '@/lib/server/workspaceSchemas';
import type { WorkspaceMeResponse } from '@/lib/workspaceTypes';

const noStoreHeaders = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
  Vary: 'Cookie'
} as const;

function toResponse(
  workspaces: WorkspaceMeResponse['workspaces'],
  activeWorkspaceId: string | null,
  activeRole: WorkspaceMeResponse['activeRole']
) {
  return NextResponse.json(
    {
      workspaces,
      activeWorkspaceId,
      activeRole
    } satisfies WorkspaceMeResponse,
    { headers: noStoreHeaders }
  );
}

export async function GET(req: NextRequest) {
  try {
    const clerkUserId = await requireClerkUserId();
    const email = await getCurrentUserPrimaryEmail();
    const profileId = await getOrCreateProfileId(clerkUserId, email);

    await bootstrapWorkspaceMembershipIfNeeded(profileId, email);

    const requestedWorkspaceId = req.nextUrl.searchParams.get('workspaceId');
    const resolved = await resolveActiveWorkspace(profileId, requestedWorkspaceId);

    return toResponse(
      resolved.workspaces,
      resolved.activeWorkspaceId,
      resolved.activeRole
    );
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to load workspace context' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const parsed = setActiveWorkspaceSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const clerkUserId = await requireClerkUserId();
    const email = await getCurrentUserPrimaryEmail();
    const profileId = await getOrCreateProfileId(clerkUserId, email);

    await setActiveWorkspaceId(profileId, parsed.data.activeWorkspaceId);
    const resolved = await resolveActiveWorkspace(
      profileId,
      parsed.data.activeWorkspaceId
    );

    return toResponse(
      resolved.workspaces,
      resolved.activeWorkspaceId,
      resolved.activeRole
    );
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof Error && e.message === 'FORBIDDEN_WORKSPACE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Failed to update active workspace' },
      { status: 500 }
    );
  }
}
