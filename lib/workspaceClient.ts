import type { WorkspaceMeResponse } from '@/lib/workspaceTypes';

export function isRemoteViewsConfigured(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_REMOTE_VIEWS === 'true';
}

export async function fetchWorkspaceMe(
  workspaceId?: string | null
): Promise<WorkspaceMeResponse> {
  const qs =
    workspaceId ?
      `?workspaceId=${encodeURIComponent(workspaceId)}`
    : '';
  const res = await fetch(`/api/workspaces/me${qs}`, {
    credentials: 'include',
    cache: 'no-store'
  });
  const json = (await res.json()) as WorkspaceMeResponse & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? 'Could not load workspace context.');
  }
  return json;
}

export async function setActiveWorkspace(
  activeWorkspaceId: string
): Promise<WorkspaceMeResponse> {
  const res = await fetch('/api/workspaces/me', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activeWorkspaceId })
  });
  const json = (await res.json()) as WorkspaceMeResponse & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? 'Could not switch workspace.');
  }
  return json;
}

export function canUseRemoteViews(
  activeWorkspaceId: string | null | undefined
): boolean {
  return isRemoteViewsConfigured() && !!activeWorkspaceId;
}
