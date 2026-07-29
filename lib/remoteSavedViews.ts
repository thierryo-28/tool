import type { TabViewPayload } from './plannerViewPayloads';
import type { SavedPlannerTab, SavedViewRecord } from './savedViews';

export async function listRemoteViewsForTab(
  workspaceId: string,
  tab: SavedPlannerTab
): Promise<SavedViewRecord[]> {
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
  workspaceId: string,
  tab: SavedPlannerTab,
  name: string,
  payload: TabViewPayload
): Promise<SavedViewRecord> {
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
    details?: unknown;
  };
  if (!res.ok || !json.view) {
    const detailSuffix =
      json.details !== undefined ?
        ` ${typeof json.details === 'string' ? json.details : JSON.stringify(json.details)}`
      : '';
    throw new Error((json.error ?? 'Could not save shared view.') + detailSuffix);
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
