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
  body varchar(2000) not null check (length(trim(body)) between 0 and 2000),
  image_url text,
  audio_url text,
  audio_duration integer,
  created_at timestamptz not null default now()
);

alter table public.couple_messages add column if not exists image_url text;
alter table public.couple_messages add column if not exists audio_url text;
alter table public.couple_messages add column if not exists audio_duration integer;
alter table public.couple_messages drop constraint if exists couple_messages_body_check;
alter table public.couple_messages add constraint couple_messages_body_check
  check (length(trim(body)) between 0 and 2000);
alter table public.couple_messages drop constraint if exists couple_messages_content_present;
alter table public.couple_messages add constraint couple_messages_content_present
  check (length(trim(body)) > 0 or image_url is not null or audio_url is not null);
alter table public.couple_messages drop constraint if exists couple_messages_audio_duration_check;
alter table public.couple_messages add constraint couple_messages_audio_duration_check
  check (
    (audio_url is null and audio_duration is null)
    or (audio_url is not null and audio_duration between 1 and 120)
  );

create index if not exists idx_daily_snaps_couple_date
  on public.daily_snaps (couple_id, snap_date, created_at desc);
create index if not exists idx_snap_comments_snap_created
  on public.snap_comments (snap_id, created_at);
create index if not exists idx_snap_comments_couple_created
  on public.snap_comments (couple_id, created_at);
create index if not exists idx_couple_messages_couple_created
  on public.couple_messages (couple_id, created_at);

drop policy if exists "Couple members can receive private call signals" on realtime.messages;
create policy "Couple members can receive private call signals" on realtime.messages
  for select to authenticated using (
    extension = 'broadcast'
    and exists (
      select 1 from public.couples
      where couples.id::text = split_part(realtime.topic(), ':', 2)
        and (couples.partner_1_id = auth.uid() or couples.partner_2_id = auth.uid())
    )
  );

drop policy if exists "Couple members can send private call signals" on realtime.messages;
create policy "Couple members can send private call signals" on realtime.messages
  for insert to authenticated with check (
    extension = 'broadcast'
    and exists (
      select 1 from public.couples
      where couples.id::text = split_part(realtime.topic(), ':', 2)
        and (couples.partner_1_id = auth.uid() or couples.partner_2_id = auth.uid())
    )
  );

alter table public.couples enable row level security;
alter table public.daily_snaps enable row level security;
alter table public.snap_comments enable row level security;
alter table public.couple_messages enable row level security;

drop policy if exists "Users can view their own couple" on public.couples;
create policy "Users can view their own couple" on public.couples
  for select using (auth.uid() = partner_1_id or auth.uid() = partner_2_id);

drop policy if exists "Authenticated users can create a couple" on public.couples;
create policy "Authenticated users can create a couple" on public.couples
  for insert with check (
    auth.uid() = partner_1_id and partner_2_id is null and partner_2_name is null
  );

-- Invitation codes are not exposed through a policy that lists all open rooms.
-- Joining and leaving are handled by narrowly scoped RPCs instead of broad UPDATE policies.
drop policy if exists "Partner 2 can join an open couple" on public.couples;
drop policy if exists "Authenticated users can find open couples" on public.couples;
drop policy if exists "Partner 1 can delete own couple" on public.couples;

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
  if exists (
    select 1 from public.couples
    where partner_1_id = auth.uid() or partner_2_id = auth.uid()
  ) then
    raise exception 'Akun ini sudah terhubung ke ruang lain. Keluar dari ruang tersebut terlebih dahulu.';
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

create or replace function public.leave_couple()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  removed_count integer;
begin
  if current_user_id is null then
    raise exception 'Kamu harus masuk terlebih dahulu.';
  end if;

  delete from public.couples where partner_1_id = current_user_id;
  get diagnostics removed_count = row_count;
  if removed_count > 0 then return true; end if;

  update public.couples
    set partner_2_id = null, partner_2_name = null
    where partner_2_id = current_user_id;
  get diagnostics removed_count = row_count;
  if removed_count > 0 then return true; end if;

  raise exception 'Akun ini tidak sedang berada di ruang pasangan.';
end;
$$;

revoke all on function public.leave_couple() from public;
grant execute on function public.leave_couple() to authenticated;

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
