'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { WorkspaceRole } from '@/lib/workspaceTypes';

interface WorkspaceMember {
  workspaceId: string;
  profileId: string;
  role: WorkspaceRole;
  clerkUserId: string;
  email: string | null;
  fullName: string | null;
}

interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  status: string;
  createdAt: string;
}

const roleOptions: WorkspaceRole[] = ['admin', 'user', 'viewer'];

interface Props {
  workspaceId: string;
}

export const WorkspaceAdminPanel: React.FC<Props> = ({ workspaceId }) => {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [newRole, setNewRole] = useState<WorkspaceRole>('viewer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/members`,
        {
          cache: 'no-store',
          credentials: 'include'
        }
      );
      const json = (await res.json()) as {
        members?: WorkspaceMember[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? 'Could not load members.');
      }
      setMembers(json.members ?? []);

      const invitesRes = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/invite`,
        {
          cache: 'no-store',
          credentials: 'include'
        }
      );
      const invitesJson = (await invitesRes.json()) as {
        invites?: WorkspaceInvite[];
      };
      if (invitesRes.ok) {
        setInvites(invitesJson.invites ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load members.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const inviteMember = async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/invite`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: inviteEmail, role: newRole })
        }
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? 'Could not create invite.');
      }
      setMessage('Invitation sent.');
      setInviteEmail('');
      await loadMembers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create invite.');
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (profileId: string, role: WorkspaceRole) => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(profileId)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId, role })
        }
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? 'Could not update role.');
      }
      setMessage('Role updated.');
      await loadMembers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update role.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">Workspace members</div>
          <div className="panel-subtitle">
            Manage `admin`, `user`, and `viewer` roles
          </div>
        </div>
      </div>

      <div className="button-row no-print">
        <button type="button" className="button button-secondary" onClick={loadMembers}>
          {loading ? 'Loading…' : 'Refresh members'}
        </button>
      </div>

      <div className="field-grid" style={{ marginTop: 8 }}>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="member-email">Invite member by email</label>
          <input
            id="member-email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="name@company.com"
          />
        </div>
        <div className="field">
          <label htmlFor="member-role">Role</label>
          <select
            id="member-role"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as WorkspaceRole)}
          >
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ alignSelf: 'end' }}>
          <button type="button" className="button" onClick={inviteMember}>
            Send invite
          </button>
        </div>
      </div>

      {error ? <div className="saved-views-error">{error}</div> : null}
      {message ? <div className="saved-views-select-span">{message}</div> : null}

      <div className="table-wrapper" style={{ marginTop: 10 }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Clerk user id</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={4}>No members loaded yet.</td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.profileId}>
                  <td>{m.fullName ?? '-'}</td>
                  <td>{m.email ?? '-'}</td>
                  <td>{m.clerkUserId}</td>
                  <td>
                    <select
                      value={m.role}
                      onChange={(e) =>
                        updateRole(m.profileId, e.target.value as WorkspaceRole)
                      }
                    >
                      {roleOptions.map((r) => (
                        <option key={`${m.profileId}-${r}`} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="table-wrapper" style={{ marginTop: 14 }}>
        <table>
          <thead>
            <tr>
              <th>Pending invite email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 ? (
              <tr>
                <td colSpan={4}>No pending invites.</td>
              </tr>
            ) : (
              invites.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.email}</td>
                  <td>{inv.role}</td>
                  <td>{inv.status}</td>
                  <td>{new Date(inv.createdAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
