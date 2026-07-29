# Remote Shared Views Setup (Clerk + Supabase + Vercel)

1. Copy `.env.example` to `.env.local` and fill keys.
2. Run `supabase/schema.sql` in your Supabase SQL editor.
3. Set `NEXT_PUBLIC_ENABLE_REMOTE_VIEWS=true` in Vercel / `.env.local`.
4. Deploy with Clerk and Supabase env vars in Project Settings.

## How workspace access works (Alternative A)

- The **first signed-in user** with no existing workspace in the database becomes **admin** and a workspace is created automatically.
- That admin invites participants by email from the planner **Admin** tab (any email domain).
- Invited users receive a Clerk invitation; when they sign up, they are added to the workspace automatically.
- Users who sign in **without an invite** while a workspace already exists get **no workspace access** (saved views stay local-only until invited).

### Legacy manual bootstrap (optional)

If you pre-created a workspace in Supabase before enabling auto-bootstrap, set `NEXT_PUBLIC_DEFAULT_WORKSPACE_ID` to that workspace id. The **first user to sign in** while that workspace has **zero members** becomes admin.

You no longer need manual SQL to create the first admin in new deployments.

## Phase C (future multi-tenant)

The API is structured for multiple workspaces per user:

- `GET /api/workspaces/me` — list memberships and resolve the active workspace
- `PATCH /api/workspaces/me` — persist `active_workspace_id` in `profile_preferences`
- Later: `POST /api/workspaces` to create additional orgs and a workspace switcher in the UI

Notes:
- The toolbar falls back to local storage if remote config/auth/workspace access is unavailable.
- API routes are under `/api/views` and require a signed-in Clerk user with workspace membership.
- Workspace roles (`admin`, `user`, `viewer`) are separate from per-view share permissions (`planner_view_shares`).
