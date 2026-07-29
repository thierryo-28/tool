export type WorkspaceRole = 'admin' | 'user' | 'viewer';

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: WorkspaceRole;
}

export interface WorkspaceMeResponse {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
  activeRole: WorkspaceRole | null;
}
