# Remote Shared Views Setup (Clerk + Supabase + Vercel)

1. Copy `.env.example` to `.env.local` and fill keys.
2. Run `supabase/schema.sql` in your Supabase SQL editor.
3. Create your first workspace and membership in Supabase:

```sql
-- Replace with your Clerk user id after first sign-in.
insert into profiles (clerk_user_id) values ('user_xxx')
on conflict (clerk_user_id) do nothing;

with p as (
  select id from profiles where clerk_user_id = 'user_xxx'
), w as (
  insert into workspaces (name, created_by_profile_id)
  select 'Default Workspace', p.id from p
  returning id
)
insert into workspace_memberships (workspace_id, profile_id, role)
select w.id, p.id, 'admin'::app_role
from w, p;
```

4. Set `NEXT_PUBLIC_DEFAULT_WORKSPACE_ID` to the workspace id.
5. Set `NEXT_PUBLIC_ENABLE_REMOTE_VIEWS=true`.
6. Deploy to Vercel with the same env vars in Project Settings.

Notes:
- The toolbar automatically falls back to local storage if remote config/auth is unavailable.
- API routes are under `/api/views` and require a signed-in Clerk user.
