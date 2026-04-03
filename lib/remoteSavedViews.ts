import type { TabViewPayload } from './plannerViewPayloads';
import type { SavedPlannerTab, SavedViewRecord } from './savedViews';

function getDefaultWorkspaceId(): string | null {
  return process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID ?? null;
}

export function isRemoteViewsEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_ENABLE_REMOTE_VIEWS === 'true' &&
    !!getDefaultWorkspaceId()
  );
}

export async function listRemoteViewsForTab(
  tab: SavedPlannerTab
): Promise<SavedViewRecord[]> {
  const workspaceId = getDefaultWorkspaceId();
  if (!workspaceId) throw new Error('Missing NEXT_PUBLIC_DEFAULT_WORKSPACE_ID');

  const res = await fetch(
    `/api/views?workspaceId=${encodeURIComponent(workspaceId)}&tab=${encodeURIComponent(tab)}`,
    {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store'
    }
  );
  if (!res.ok) {
    throw new Error('Could not load shared views.');
  }
  const json = (await res.json()) as { views?: SavedViewRecord[] };
  return json.views ?? [];
}

export async function saveRemoteNamedView(
  tab: SavedPlannerTab,
  name: string,
  payload: TabViewPayload
): Promise<SavedViewRecord> {
  const workspaceId = getDefaultWorkspaceId();
  if (!workspaceId) throw new Error('Missing NEXT_PUBLIC_DEFAULT_WORKSPACE_ID');

  const res = await fetch('/api/views', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      workspaceId,
      tab,
      name,
      payload
    })
  });
  const json = (await res.json()) as {
    view?: SavedViewRecord;
    error?: string;
  };
  if (!res.ok || !json.view) {
    throw new Error(json.error ?? 'Could not save shared view.');
  }
  return json.view;
}

export async function deleteRemoteSavedView(id: string): Promise<void> {
  const res = await fetch(`/api/views/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(json?.error ?? 'Could not delete shared view.');
  }
}
