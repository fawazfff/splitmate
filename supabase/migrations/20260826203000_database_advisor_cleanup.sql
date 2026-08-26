drop index if exists public.idx_agent_conversations_group;
drop index if exists public.idx_agent_messages_conversation;

create index if not exists idx_expense_splits_member
  on public.expense_splits (member_id);
create index if not exists idx_expenses_paid_by
  on public.expenses (paid_by);
create index if not exists idx_settlements_from_member
  on public.settlements (from_member);
create index if not exists idx_settlements_to_member
  on public.settlements (to_member);

drop policy if exists "server only" on public.groups;
create policy "server only" on public.groups
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "server only" on public.group_members;
create policy "server only" on public.group_members
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "server only" on public.expenses;
create policy "server only" on public.expenses
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "server only" on public.expense_splits;
create policy "server only" on public.expense_splits
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "server only" on public.agent_conversations;
create policy "server only" on public.agent_conversations
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "server only" on public.agent_messages;
create policy "server only" on public.agent_messages
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "server only" on public.settlements;
create policy "server only" on public.settlements
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "server only" on public.api_rate_limits;
create policy "server only" on public.api_rate_limits
  for all to anon, authenticated using (false) with check (false);
