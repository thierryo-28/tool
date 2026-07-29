'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { TabViewPayload } from '@/lib/plannerViewPayloads';
import type { SavedPlannerTab, SavedViewRecord } from '@/lib/savedViews';
import {
  deleteSavedView,
  listViewsForTab,
  saveNamedView
} from '@/lib/savedViews';
import {
  deleteRemoteSavedView,
  listRemoteViewsForTab,
  saveRemoteNamedView
} from '@/lib/remoteSavedViews';
import { canUseRemoteViews } from '@/lib/workspaceClient';

interface Props {
  tab: SavedPlannerTab;
  workspaceId: string | null;
  workspaceReady?: boolean;
  getPayload: () => TabViewPayload;
  onApply: (payload: TabViewPayload) => void;
}

export const SavedViewsToolbar: React.FC<Props> = ({
  tab,
  workspaceId,
  workspaceReady = true,
  getPayload,
  onApply
}) => {
  const remoteEnabled = canUseRemoteViews(workspaceId);

  const [views, setViews] = useState<SavedViewRecord[]>(() =>
    listViewsForTab(tab)
  );
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [modeNotice, setModeNotice] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState('');
  const [deleteKey, setDeleteKey] = useState('');
  const [remoteUnavailable, setRemoteUnavailable] = useState(false);

  const refresh = useCallback(async () => {
    if (!remoteEnabled) {
      setViews(listViewsForTab(tab));
      setModeNotice(null);
      setRemoteUnavailable(false);
      return;
    }
    if (!workspaceId) {
      setViews(listViewsForTab(tab));
      setModeNotice(
        workspaceReady ?
          'Using local saved views (no workspace access).'
        : null
      );
      setRemoteUnavailable(false);
      return;
    }
    try {
      const remote = await listRemoteViewsForTab(workspaceId, tab);
      setViews(remote);
      setModeNotice(null);
      setRemoteUnavailable(false);
    } catch {
      setViews(listViewsForTab(tab));
      setModeNotice('Using local saved views (remote unavailable).');
      setRemoteUnavailable(true);
    }
  }, [remoteEnabled, workspaceId, workspaceReady, tab]);

  useEffect(() => {
    refresh();
  }, [tab, refresh]);

  const viewOptions = useMemo(
    () =>
      views.map((v) => (
        <option key={v.id} value={v.id}>
          {v.name}
        </option>
      )),
    [views]
  );

  const handleSave = async () => {
    setSaveError(null);
    try {
      const payload = getPayload();
      if (remoteEnabled && workspaceId) {
        if (remoteUnavailable) {
          saveNamedView(tab, saveName, payload);
          setModeNotice('Saved locally (remote unavailable).');
        } else {
          let saved = false;
          let lastErr: unknown = null;
          for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
              await saveRemoteNamedView(workspaceId, tab, saveName, payload);
              saved = true;
              break;
            } catch (e) {
              lastErr = e;
            }
          }
          if (!saved) {
            throw (
              lastErr ??
              new Error('Could not save shared view. Please try again.')
            );
          }
          setModeNotice(null);
        }
      } else {
        saveNamedView(tab, saveName, payload);
      }
      setSaveName('');
      setSaveOpen(false);
      await refresh();
    } catch (e) {
      setSaveError(
        e instanceof Error ?
          e.message
        : 'Could not save shared view right now. Please retry.'
      );
    }
  };

  const handleLoadSelect = (id: string) => {
    if (!id) return;
    const found = views.find((v) => v.id === id);
    if (found) onApply(found.payload);
    setLoadKey('');
  };

  const handleDeleteSelect = async (id: string) => {
    if (!id) return;
    if (!window.confirm('Delete this saved view?')) {
      setDeleteKey('');
      return;
    }
    if (remoteEnabled && workspaceId) {
      try {
        await deleteRemoteSavedView(id);
        setModeNotice(null);
      } catch {
        deleteSavedView(id);
        setModeNotice('Deleted local view (remote unavailable).');
      }
    } else {
      deleteSavedView(id);
    }
    await refresh();
    setDeleteKey('');
  };

  return (
    <div className="saved-views-toolbar no-print">
      <div className="saved-views-toolbar-inner">
        <button
          type="button"
          className="button button-secondary button-small"
          onClick={() => {
            setSaveOpen(true);
            setSaveError(null);
          }}
        >
          Save named view
        </button>

        <label className="saved-views-select-label">
          <span className="saved-views-select-span">Load view</span>
          <select
            className="saved-views-select"
            value={loadKey}
            onChange={(e) => {
              const v = e.target.value;
              setLoadKey(v);
              handleLoadSelect(v);
            }}
          >
            <option value="">Select…</option>
            {viewOptions}
          </select>
        </label>

        <label className="saved-views-select-label">
          <span className="saved-views-select-span">Delete</span>
          <select
            className="saved-views-select"
            value={deleteKey}
            onChange={(e) => {
              const v = e.target.value;
              setDeleteKey(v);
              handleDeleteSelect(v);
            }}
          >
            <option value="">Select…</option>
            {viewOptions}
          </select>
        </label>
      </div>

      {saveOpen ? (
        <div
          className="saved-views-modal-backdrop"
          role="presentation"
          onClick={() => setSaveOpen(false)}
        >
          <div
            className="saved-views-modal"
            role="dialog"
            aria-labelledby="save-view-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div id="save-view-title" className="saved-views-modal-title">
              Save named view
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <label htmlFor="save-view-name">Name</label>
              <input
                id="save-view-name"
                type="text"
                maxLength={80}
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g. FY26 base case"
                autoFocus
              />
            </div>
            {saveError ? (
              <div className="saved-views-error">{saveError}</div>
            ) : null}
            <div className="saved-views-modal-actions">
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => setSaveOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-small"
                onClick={handleSave}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {modeNotice ? <div className="saved-views-error">{modeNotice}</div> : null}
    </div>
  );
};
