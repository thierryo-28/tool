import type { TabViewPayload } from './plannerViewPayloads';

export const SAVED_VIEWS_STORAGE_KEY = 'revenuePlanner.savedViews.v1';
export const MAX_SAVED_VIEWS = 50;
export const MAX_VIEW_NAME_LENGTH = 80;

export type SavedPlannerTab = 'capacity' | 'demand' | 'pipeline' | 'sdr';

export interface SavedViewRecord {
  id: string;
  name: string;
  tab: SavedPlannerTab;
  updatedAt: string;
  payload: TabViewPayload;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function parseStored(raw: string | null): SavedViewRecord[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(
      (row): row is SavedViewRecord =>
        row &&
        typeof row === 'object' &&
        typeof (row as SavedViewRecord).id === 'string' &&
        typeof (row as SavedViewRecord).name === 'string' &&
        ['capacity', 'demand', 'pipeline', 'sdr'].includes(
          (row as SavedViewRecord).tab
        ) &&
        typeof (row as SavedViewRecord).updatedAt === 'string' &&
        (row as SavedViewRecord).payload !== undefined
    );
  } catch {
    return [];
  }
}

export function loadAllSavedViews(): SavedViewRecord[] {
  if (typeof window === 'undefined') return [];
  return parseStored(window.localStorage.getItem(SAVED_VIEWS_STORAGE_KEY));
}

function persistAll(views: SavedViewRecord[]): void {
  if (typeof window === 'undefined') return;
  const json = JSON.stringify(views);
  try {
    window.localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, json);
  } catch (e) {
    const err = e as { name?: string };
    if (err?.name === 'QuotaExceededError') {
      throw new Error(
        'Storage is full. Delete an old named view or clear site data.'
      );
    }
    throw e;
  }
}

export function listViewsForTab(tab: SavedPlannerTab): SavedViewRecord[] {
  return loadAllSavedViews()
    .filter((v) => v.tab === tab)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveNamedView(
  tab: SavedPlannerTab,
  name: string,
  payload: TabViewPayload
): SavedViewRecord {
  const trimmed = name.trim().slice(0, MAX_VIEW_NAME_LENGTH);
  if (!trimmed) {
    throw new Error('Enter a name for this view.');
  }

  const all = loadAllSavedViews();
  const now = new Date().toISOString();

  const duplicate = all.find(
    (v) => v.tab === tab && v.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (duplicate) {
    const next = all.map((v) =>
      v.id === duplicate.id
        ? { ...v, name: trimmed, updatedAt: now, payload }
        : v
    );
    persistAll(next);
    return next.find((v) => v.id === duplicate.id)!;
  }

  if (all.length >= MAX_SAVED_VIEWS) {
    throw new Error(
      `You can save at most ${MAX_SAVED_VIEWS} named views. Delete one to add another.`
    );
  }

  const record: SavedViewRecord = {
    id: newId(),
    name: trimmed,
    tab,
    updatedAt: now,
    payload
  };
  persistAll([...all, record]);
  return record;
}

export function deleteSavedView(id: string): void {
  const all = loadAllSavedViews().filter((v) => v.id !== id);
  persistAll(all);
}

export function renameSavedView(id: string, name: string): void {
  const trimmed = name.trim().slice(0, MAX_VIEW_NAME_LENGTH);
  if (!trimmed) {
    throw new Error('Enter a name.');
  }
  const all = loadAllSavedViews();
  const target = all.find((v) => v.id === id);
  if (!target) return;
  const clash = all.some(
    (v) =>
      v.id !== id &&
      v.tab === target.tab &&
      v.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (clash) {
    throw new Error('Another view already uses that name for this tab.');
  }
  persistAll(
    all.map((v) =>
      v.id === id ? { ...v, name: trimmed, updatedAt: new Date().toISOString() } : v
    )
  );
}
