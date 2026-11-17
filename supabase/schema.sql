-- FazaHub schema. Safe to re-run in the Supabase SQL editor when updating the schema.
create extension if not exists pgcrypto;

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code varchar(6) unique not null,
  partner_1_id uuid references auth.users(id) not null,
  partner_1_name varchar(50) not null,
  partner_2_id uuid references auth.users(id),
  partner_2_name varchar(50),
  created_at timestamptz default now(),
  constraint couples_partner_2_pair check ((partner_2_id is null) = (partner_2_name is null)),
  constraint couples_distinct_partners check (partner_2_id is null or partner_1_id <> partner_2_id)
);

create unique index if not exists idx_couples_partner_1 on public.couples (partner_1_id);
create unique index if not exists idx_couples_partner_2 on public.couples (partner_2_id)
  where partner_2_id is not null;

create table if not exists public.daily_snaps (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  snap_date date not null default current_date,
  image_url text not null,
  mood varchar(30) not null,
  note varchar(200),
  created_at timestamptz default now()
);

create index if not exists idx_daily_snaps_couple_date
  on public.daily_snaps (couple_id, snap_date, created_at desc);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  couple_id uuid references public.couples(id) on delete cascade not null,
  endpoint text unique not null,
  subscription jsonb not null,
  timezone text not null default 'UTC',
  reminder_time time not null default time '20:00',
  last_reminded_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_reminders
  on public.push_subscriptions (reminder_time, timezone);

alter table public.couples enable row level security;
alter table public.daily_snaps enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can view their own couple" on public.couples;
create policy "Users can view their own couple" on public.couples
  for select using (auth.uid() = partner_1_id or auth.uid() = partner_2_id);

drop policy if exists "Authenticated users can create a couple" on public.couples;
create policy "Authenticated users can create a couple" on public.couples
  for insert with check (
    auth.uid() = partner_1_id and partner_2_id is null and partner_2_name is null
  );

-- Joining is handled by join_couple below instead of a broad UPDATE policy.
drop policy if exists "Partner 2 can join an open couple" on public.couples;

drop policy if exists "Couple members can view snaps" on public.daily_snaps;
create policy "Couple members can view snaps" on public.daily_snaps
  for select using (
    exists (
      select 1 from public.couples
      where couples.id = daily_snaps.couple_id
        and (couples.partner_1_id = auth.uid() or couples.partner_2_id = auth.uid())
    )
  );

drop policy if exists "Couple members can insert snaps" on public.daily_snaps;
create policy "Couple members can insert snaps" on public.daily_snaps
  for insert with check (
    auth.uid() = user_id and exists (
      select 1 from public.couples
      where couples.id = daily_snaps.couple_id
        and (couples.partner_1_id = auth.uid() or couples.partner_2_id = auth.uid())
    )
  );

drop policy if exists "Users can delete their own snaps" on public.daily_snaps;
create policy "Users can delete their own snaps" on public.daily_snaps
  for delete using (auth.uid() = user_id);

drop policy if exists "Users can view their own push subscriptions" on public.push_subscriptions;
create policy "Users can view their own push subscriptions" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "Users can add their own push subscriptions" on public.push_subscriptions;
create policy "Users can add their own push subscriptions" on public.push_subscriptions
  for insert with check (
    auth.uid() = user_id and exists (
      select 1 from public.couples
      where couples.id = push_subscriptions.couple_id
        and (couples.partner_1_id = auth.uid() or couples.partner_2_id = auth.uid())
    )
  );

drop policy if exists "Users can update their own push subscriptions" on public.push_subscriptions;
create policy "Users can update their own push subscriptions" on public.push_subscriptions
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id and exists (
      select 1 from public.couples
      where couples.id = push_subscriptions.couple_id
        and (couples.partner_1_id = auth.uid() or couples.partner_2_id = auth.uid())
    )
  );

drop policy if exists "Users can remove their own push subscriptions" on public.push_subscriptions;
create policy "Users can remove their own push subscriptions" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

create or replace function public.join_couple(p_invite_code text, p_partner_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  joined_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Kamu harus masuk terlebih dahulu.';
  end if;
  if length(trim(p_partner_name)) not between 1 and 50 then
    raise exception 'Nama panggilan harus berisi 1 sampai 50 karakter.';
  end if;

  update public.couples
    set partner_2_id = auth.uid(), partner_2_name = trim(p_partner_name)
    where invite_code = upper(trim(p_invite_code))
      and partner_2_id is null
      and partner_1_id <> auth.uid()
    returning id into joined_id;

  if joined_id is null then
    raise exception 'Kode undangan tidak valid atau ruang sudah berdua.';
  end if;
  return joined_id;
end;
$$;

revoke all on function public.join_couple(text, text) from public;
grant execute on function public.join_couple(text, text) to authenticated;

-- Enable replication only if these tables have not already been added.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'couples'
  ) then
    alter publication supabase_realtime add table public.couples;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_snaps'
  ) then
    alter publication supabase_realtime add table public.daily_snaps;
  end if;
end $$;
