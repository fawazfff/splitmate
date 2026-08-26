alter table public.groups
  add column if not exists state jsonb not null
  default '{"people":[],"expenses":[],"settlements":[]}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.groups drop constraint if exists groups_state_is_object;
alter table public.groups
  add constraint groups_state_is_object check (jsonb_typeof(state) = 'object');

drop index if exists public.idx_groups_client_id;
create index idx_groups_client_id on public.groups (client_id) where client_id is not null;

create unique index if not exists idx_agent_conversations_group_unique
  on public.agent_conversations (group_id);
create index if not exists idx_agent_messages_conversation_created
  on public.agent_messages (conversation_id, created_at);

create table if not exists public.api_rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);
alter table public.api_rate_limits enable row level security;

revoke all on table public.groups from anon, authenticated;
revoke all on table public.group_members from anon, authenticated;
revoke all on table public.expenses from anon, authenticated;
revoke all on table public.expense_splits from anon, authenticated;
revoke all on table public.agent_conversations from anon, authenticated;
revoke all on table public.agent_messages from anon, authenticated;
revoke all on table public.settlements from anon, authenticated;
revoke all on table public.api_rate_limits from anon, authenticated;

grant all on table public.groups to service_role;
grant all on table public.group_members to service_role;
grant all on table public.expenses to service_role;
grant all on table public.expense_splits to service_role;
grant all on table public.agent_conversations to service_role;
grant all on table public.agent_messages to service_role;
grant all on table public.settlements to service_role;
grant all on table public.api_rate_limits to service_role;

create or replace function public.consume_api_rate_limit(
  p_key text,
  p_limit integer default 20,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
  v_now timestamptz := now();
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
  v_window integer := greatest(10, least(coalesce(p_window_seconds, 60), 3600));
begin
  if p_key is null or length(p_key) < 16 or length(p_key) > 160 then
    return false;
  end if;

  insert into public.api_rate_limits as limits (key, window_start, request_count, updated_at)
  values (p_key, v_now, 1, v_now)
  on conflict (key) do update
  set
    request_count = case
      when v_now - limits.window_start >= make_interval(secs => v_window) then 1
      else limits.request_count + 1
    end,
    window_start = case
      when v_now - limits.window_start >= make_interval(secs => v_window) then v_now
      else limits.window_start
    end,
    updated_at = v_now
  returning request_count into v_count;

  return v_count <= v_limit;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;
