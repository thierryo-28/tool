-- Run this in your Supabase SQL editor before enabling remote shared views.

create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique not null,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by_profile_id uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('admin', 'user', 'viewer');
  end if;
end $$;

create table if not exists workspace_memberships (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, profile_id)
);

do $$
begin
  if not exists (select 1 from pg_type where typname = 'planner_tab') then
    create type planner_tab as enum ('capacity', 'sdr', 'demand', 'pipeline');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'share_permission') then
    create type share_permission as enum ('viewer', 'editor');
  end if;
end $$;

create table if not exists planner_views (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  owner_profile_id uuid not null references profiles(id) on delete restrict,
  tab planner_tab not null,
  name text not null,
  payload jsonb not null,
  is_public_in_workspace boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists planner_views_workspace_tab_name_ci
  on planner_views (workspace_id, tab, lower(name));

create index if not exists planner_views_workspace_tab_updated_idx
  on planner_views (workspace_id, tab, updated_at desc);

create table if not exists planner_view_shares (
  view_id uuid not null references planner_views(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  permission share_permission not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (view_id, profile_id)
);

create index if not exists planner_view_shares_profile_idx
  on planner_view_shares (profile_id, view_id);

create table if not exists workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  role app_role not null,
  clerk_invitation_id text,
  invited_by_profile_id uuid references profiles(id) on delete set null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists workspace_invites_workspace_status_idx
  on workspace_invites (workspace_id, status, created_at desc);

create unique index if not exists workspace_invites_pending_unique
  on workspace_invites (workspace_id, lower(email))
  where status = 'pending';
