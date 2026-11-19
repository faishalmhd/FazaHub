create table if not exists public.couple_games (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples(id) on delete cascade not null unique,
  game_type text not null default 'tic_tac_toe',
  status text not null default 'active',
  game_state jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.couple_games
  add column if not exists couple_id uuid references public.couples(id) on delete cascade,
  add column if not exists game_type text not null default 'tic_tac_toe',
  add column if not exists status text not null default 'active',
  add column if not exists game_state jsonb not null default '{}'::jsonb,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (select 1 from public.couple_games where couple_id is null) then
    raise exception 'couple_games has rows without couple_id; repair them before applying the Main Berdua upsert migration.';
  end if;
  alter table public.couple_games alter column couple_id set not null;
end
$$;

create unique index if not exists couple_games_couple_id_key
  on public.couple_games(couple_id);

alter table public.couple_games enable row level security;

drop policy if exists "Authenticated access couple_games" on public.couple_games;
drop policy if exists "Couple members can view games" on public.couple_games;
drop policy if exists "Couple members can insert games" on public.couple_games;
drop policy if exists "Couple members can update games" on public.couple_games;

create policy "Couple members can view games" on public.couple_games
  for select to authenticated using (
    exists (
      select 1 from public.couples
      where couples.id = couple_games.couple_id
        and (couples.partner_1_id = auth.uid() or couples.partner_2_id = auth.uid())
    )
  );

create policy "Couple members can insert games" on public.couple_games
  for insert to authenticated with check (
    exists (
      select 1 from public.couples
      where couples.id = couple_games.couple_id
        and (couples.partner_1_id = auth.uid() or couples.partner_2_id = auth.uid())
    )
  );

create policy "Couple members can update games" on public.couple_games
  for update to authenticated
  using (
    exists (
      select 1 from public.couples
      where couples.id = couple_games.couple_id
        and (couples.partner_1_id = auth.uid() or couples.partner_2_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.couples
      where couples.id = couple_games.couple_id
        and (couples.partner_1_id = auth.uid() or couples.partner_2_id = auth.uid())
    )
  );

grant select, insert, update on public.couple_games to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.couple_games;
exception
  when duplicate_object then null;
end
$$;
