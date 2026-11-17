create table if not exists public.snap_comments (
  id uuid primary key default gen_random_uuid(),
  snap_id uuid references public.daily_snaps(id) on delete cascade not null,
  couple_id uuid references public.couples(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  body varchar(500) not null check (length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.couple_messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  body varchar(2000) not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists idx_snap_comments_snap_created
  on public.snap_comments (snap_id, created_at);
create index if not exists idx_snap_comments_couple_created
  on public.snap_comments (couple_id, created_at);
create index if not exists idx_couple_messages_couple_created
  on public.couple_messages (couple_id, created_at);

alter table public.snap_comments enable row level security;
alter table public.couple_messages enable row level security;

drop policy if exists "Couple members can view snap comments" on public.snap_comments;
create policy "Couple members can view snap comments" on public.snap_comments
  for select using (
    exists (
      select 1
      from public.daily_snaps
      join public.couples on couples.id = daily_snaps.couple_id
      where daily_snaps.id = snap_comments.snap_id
        and daily_snaps.couple_id = snap_comments.couple_id
        and (couples.partner_1_id = auth.uid() or couples.partner_2_id = auth.uid())
    )
  );

drop policy if exists "Couple members can insert snap comments" on public.snap_comments;
create policy "Couple members can insert snap comments" on public.snap_comments
  for insert with check (
    auth.uid() = user_id and exists (
      select 1
      from public.daily_snaps
      join public.couples on couples.id = daily_snaps.couple_id
      where daily_snaps.id = snap_comments.snap_id
        and daily_snaps.couple_id = snap_comments.couple_id
        and (couples.partner_1_id = auth.uid() or couples.partner_2_id = auth.uid())
    )
  );

drop policy if exists "Users can delete their own snap comments" on public.snap_comments;
create policy "Users can delete their own snap comments" on public.snap_comments
  for delete using (auth.uid() = user_id);

drop policy if exists "Couple members can view messages" on public.couple_messages;
create policy "Couple members can view messages" on public.couple_messages
  for select using (
    exists (
      select 1 from public.couples
      where couples.id = couple_messages.couple_id
        and (couples.partner_1_id = auth.uid() or couples.partner_2_id = auth.uid())
    )
  );

drop policy if exists "Couple members can send messages" on public.couple_messages;
create policy "Couple members can send messages" on public.couple_messages
  for insert with check (
    auth.uid() = user_id and exists (
      select 1 from public.couples
      where couples.id = couple_messages.couple_id
        and (couples.partner_1_id = auth.uid() or couples.partner_2_id = auth.uid())
    )
  );

drop policy if exists "Users can delete their own messages" on public.couple_messages;
create policy "Users can delete their own messages" on public.couple_messages
  for delete using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'snap_comments'
  ) then
    alter publication supabase_realtime add table public.snap_comments;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'couple_messages'
  ) then
    alter publication supabase_realtime add table public.couple_messages;
  end if;
end $$;
