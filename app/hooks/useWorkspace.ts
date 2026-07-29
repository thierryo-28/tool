'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceMeResponse, WorkspaceRole } from '@/lib/workspaceTypes';
import { fetchWorkspaceMe } from '@/lib/workspaceClient';

export type WorkspaceAccessState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | {
      status: 'ready';
      workspaces: WorkspaceMeResponse['workspaces'];
      activeWorkspaceId: string | null;
      activeRole: WorkspaceRole | null;
    }
  | { status: 'error'; message: string };

export function useWorkspace(): WorkspaceAccessState & {
  refresh: () => Promise<void>;
  isAdmin: boolean;
} {
  const { isLoaded, userId } = useAuth();
  const [state, setState] = useState<WorkspaceAccessState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    if (!isLoaded) return;
    if (!userId) {
      setState({ status: 'signed-out' });
      return;
    }

    setState({ status: 'loading' });
    try {
      const data = await fetchWorkspaceMe();
      setState({
        status: 'ready',
        workspaces: data.workspaces,
        activeWorkspaceId: data.activeWorkspaceId,
        activeRole: data.activeRole
      });
    } catch (e) {
      setState({
        status: 'error',
        message:
          e instanceof Error ?
            e.message
          : 'Could not load workspace context.'
      });
    }
  }, [isLoaded, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isAdmin =
    state.status === 'ready' && state.activeRole === 'admin';

  return { ...state, refresh, isAdmin };
}
