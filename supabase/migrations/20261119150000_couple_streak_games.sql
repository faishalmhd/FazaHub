alter table public.couples
  add column if not exists streak_count integer not null default 0,
  add column if not exists last_streak_date date,
  add column if not exists streak_freeze_count integer not null default 2,
  add column if not exists user1_active_date date,
  add column if not exists user2_active_date date;

with shared_days as (
  select c.id as couple_id, ds.snap_date
  from public.couples c
  join public.daily_snaps ds on ds.couple_id = c.id
  group by c.id, c.partner_1_id, c.partner_2_id, ds.snap_date
  having bool_or(ds.user_id = c.partner_1_id)
     and bool_or(ds.user_id = c.partner_2_id)
), numbered_days as (
  select couple_id, snap_date,
         snap_date - row_number() over (partition by couple_id order by snap_date)::integer as streak_group
  from shared_days
), streaks as (
  select couple_id, max(snap_date) as last_day, count(*)::integer as day_count
  from numbered_days
  group by couple_id, streak_group
), latest_streak as (
  select distinct on (couple_id) couple_id, last_day, day_count
  from streaks
  order by couple_id, last_day desc
), activity_dates as (
  select c.id as couple_id,
         max(ds.snap_date) filter (where ds.user_id = c.partner_1_id) as user1_date,
         max(ds.snap_date) filter (where ds.user_id = c.partner_2_id) as user2_date
  from public.couples c
  left join public.daily_snaps ds on ds.couple_id = c.id
  group by c.id, c.partner_1_id, c.partner_2_id
)
update public.couples c
set streak_count = case
      when latest_streak.last_day >= current_date - 1 then latest_streak.day_count
      else 0
    end,
    last_streak_date = latest_streak.last_day,
    user1_active_date = activity_dates.user1_date,
    user2_active_date = activity_dates.user2_date
from activity_dates
left join latest_streak on latest_streak.couple_id = activity_dates.couple_id
where c.id = activity_dates.couple_id;

create table if not exists public.couple_games (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples(id) on delete cascade not null unique,
  game_type text not null default 'tic_tac_toe'
    check (game_type in ('tic_tac_toe', 'rock_paper_scissors', 'couple_quiz')),
  status text not null default 'active',
  game_state jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

delete from public.couple_games a
using public.couple_games b
where a.couple_id = b.couple_id and a.ctid < b.ctid;

create unique index if not exists couple_games_couple_id_key on public.couple_games(couple_id);
alter table public.couple_games enable row level security;

drop policy if exists "Authenticated access couple_games" on public.couple_games;
drop policy if exists "Couple members can view games" on public.couple_games;
create policy "Couple members can view games" on public.couple_games
  for select to authenticated using (
    exists (
      select 1 from public.couples
      where couples.id = couple_games.couple_id
        and (couples.partner_1_id = auth.uid() or couples.partner_2_id = auth.uid())
    )
  );

grant select on public.couple_games to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.couple_games;
exception
  when duplicate_object then null;
end
$$;

create or replace function public.record_couple_activity(p_couple_id uuid)
returns public.couples
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_couple public.couples%rowtype;
  v_missed_days integer;
begin
  select * into v_couple
  from public.couples
  where id = p_couple_id
    and (partner_1_id = auth.uid() or partner_2_id = auth.uid())
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'You are not a member of this couple.';
  end if;

  if not exists (
    select 1
    from public.daily_snaps
    where couple_id = p_couple_id
      and user_id = auth.uid()
      and snap_date = current_date
  ) then
    raise exception using errcode = '22023', message = 'Save a snap today before recording couple activity.';
  end if;

  if auth.uid() = v_couple.partner_1_id then
    v_couple.user1_active_date := current_date;
  else
    v_couple.user2_active_date := current_date;
  end if;

  if v_couple.user1_active_date = current_date
     and v_couple.user2_active_date = current_date
     and v_couple.last_streak_date is distinct from current_date then
    if v_couple.last_streak_date is null then
      v_couple.streak_count := 1;
    else
      v_missed_days := current_date - v_couple.last_streak_date - 1;
      if v_missed_days <= coalesce(v_couple.streak_freeze_count, 0) then
        v_couple.streak_count := coalesce(v_couple.streak_count, 0) + v_missed_days + 1;
        v_couple.streak_freeze_count := coalesce(v_couple.streak_freeze_count, 0) - v_missed_days;
      else
        v_couple.streak_count := 1;
      end if;
    end if;
    v_couple.last_streak_date := current_date;
  end if;

  update public.couples
  set user1_active_date = v_couple.user1_active_date,
      user2_active_date = v_couple.user2_active_date,
      streak_count = v_couple.streak_count,
      streak_freeze_count = v_couple.streak_freeze_count,
      last_streak_date = v_couple.last_streak_date
  where id = p_couple_id
  returning * into v_couple;

  return v_couple;
end;
$$;

revoke all on function public.record_couple_activity(uuid) from public;
grant execute on function public.record_couple_activity(uuid) to authenticated;

create or replace function public.submit_couple_game_action(p_couple_id uuid, p_action jsonb)
returns public.couple_games
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_couple public.couples%rowtype;
  v_game public.couple_games%rowtype;
  v_state jsonb;
  v_action_type text := p_action->>'type';
  v_game_type text;
  v_requested_type text;
  v_user_id text := auth.uid()::text;
  v_partner_id uuid;
  v_mark text;
  v_board jsonb;
  v_index integer;
  v_lines text[] := array['012', '345', '678', '036', '147', '258', '048', '246'];
  v_line text;
  v_a integer;
  v_b integer;
  v_c integer;
  v_winner text;
  v_draw boolean;
  v_choices jsonb;
  v_choice text;
  v_choice_1 text;
  v_choice_2 text;
  v_result text;
  v_answers jsonb;
  v_answer text;
  v_scores jsonb;
  v_score_1 integer;
  v_score_2 integer;
  v_question_index integer;
begin
  select * into v_couple
  from public.couples
  where id = p_couple_id
    and (partner_1_id = auth.uid() or partner_2_id = auth.uid());

  if not found then
    raise exception using errcode = '42501', message = 'You are not a member of this couple.';
  end if;

  if v_couple.partner_1_id = auth.uid() then
    v_partner_id := v_couple.partner_2_id;
  else
    v_partner_id := v_couple.partner_1_id;
  end if;

  if v_partner_id is null then
    raise exception using errcode = '22023', message = 'Your partner has not joined this couple yet.';
  end if;

  insert into public.couple_games (couple_id, game_type, game_state, updated_by)
  values (
    p_couple_id,
    'tic_tac_toe',
    jsonb_build_object('board', jsonb_build_array(null, null, null, null, null, null, null, null, null), 'turn', null, 'winner', null, 'draw', false),
    auth.uid()
  )
  on conflict (couple_id) do nothing;

  select * into v_game
  from public.couple_games
  where couple_id = p_couple_id
  for update;

  v_game_type := v_game.game_type;
  v_state := v_game.game_state;

  if v_action_type = 'select' then
    v_requested_type := p_action->>'game_type';
    if v_requested_type is null or v_requested_type not in ('tic_tac_toe', 'rock_paper_scissors', 'couple_quiz') then
      raise exception using errcode = '22023', message = 'Unknown game type.';
    end if;
    if v_requested_type <> v_game_type then
      v_game_type := v_requested_type;
      v_state := case v_game_type
        when 'tic_tac_toe' then jsonb_build_object('board', jsonb_build_array(null, null, null, null, null, null, null, null, null), 'turn', null, 'winner', null, 'draw', false)
        when 'rock_paper_scissors' then jsonb_build_object('round', 1, 'choices', '{}'::jsonb, 'result', null)
        else jsonb_build_object('questionIndex', 0, 'answers', '{}'::jsonb, 'scores', '{}'::jsonb, 'revealed', false)
      end;
    end if;
  elsif v_action_type = 'reset' then
    v_state := case v_game_type
      when 'tic_tac_toe' then jsonb_build_object('board', jsonb_build_array(null, null, null, null, null, null, null, null, null), 'turn', null, 'winner', null, 'draw', false)
      when 'rock_paper_scissors' then jsonb_build_object('round', 1, 'choices', '{}'::jsonb, 'result', null)
      else jsonb_build_object('questionIndex', 0, 'answers', '{}'::jsonb, 'scores', '{}'::jsonb, 'revealed', false)
    end;
  elsif v_game_type = 'tic_tac_toe' and v_action_type = 'move' then
    if coalesce(p_action->>'index', '') !~ '^[0-8]$' then
      raise exception using errcode = '22023', message = 'Invalid board position.';
    end if;
    v_index := (p_action->>'index')::integer;
    v_board := v_state->'board';
    if v_state->>'winner' is not null or coalesce((v_state->>'draw')::boolean, false)
       or v_board->v_index <> 'null'::jsonb
       or (v_state->>'turn' is not null and v_state->>'turn' <> v_user_id) then
      raise exception using errcode = '22023', message = 'It is not your turn or that position is unavailable.';
    end if;
    v_mark := case when auth.uid() = v_couple.partner_1_id then 'X' else 'O' end;
    v_board := jsonb_set(v_board, array[v_index::text], to_jsonb(v_mark), false);
    v_winner := null;
    foreach v_line in array v_lines loop
      v_a := substr(v_line, 1, 1)::integer;
      v_b := substr(v_line, 2, 1)::integer;
      v_c := substr(v_line, 3, 1)::integer;
      if v_board->>v_a is not null
         and v_board->>v_a = v_board->>v_b
         and v_board->>v_b = v_board->>v_c then
        v_winner := v_user_id;
        exit;
      end if;
    end loop;
    select not exists (
      select 1 from jsonb_array_elements(v_board) as cell(value)
      where cell.value = 'null'::jsonb
    ) and v_winner is null into v_draw;
    v_state := jsonb_build_object(
      'board', v_board,
      'turn', case when v_winner is null and not v_draw then to_jsonb(v_partner_id::text) else 'null'::jsonb end,
      'winner', case when v_winner is null then 'null'::jsonb else to_jsonb(v_winner) end,
      'winnerMark', case when v_winner is null then 'null'::jsonb else to_jsonb(v_mark) end,
      'draw', v_draw
    );
  elsif v_game_type = 'rock_paper_scissors' and v_action_type = 'choose' then
    v_choice := p_action->>'choice';
    if v_choice is null or v_choice not in ('rock', 'paper', 'scissors') then
      raise exception using errcode = '22023', message = 'Invalid choice.';
    end if;
    v_choices := coalesce(v_state->'choices', '{}'::jsonb);
    if v_state->>'result' is not null then
      v_state := jsonb_build_object(
        'round', coalesce((v_state->>'round')::integer, 1) + 1,
        'choices', '{}'::jsonb,
        'result', null
      );
      v_choices := '{}'::jsonb;
    end if;
    v_choices := jsonb_set(v_choices, array[v_user_id], to_jsonb(v_choice), true);
    v_choice_1 := v_choices->>v_couple.partner_1_id::text;
    v_choice_2 := v_choices->>v_couple.partner_2_id::text;
    v_result := null;
    if v_choice_1 is not null and v_choice_2 is not null then
      if v_choice_1 = v_choice_2 then
        v_result := 'draw';
      elsif (v_choice_1 = 'rock' and v_choice_2 = 'scissors')
         or (v_choice_1 = 'paper' and v_choice_2 = 'rock')
         or (v_choice_1 = 'scissors' and v_choice_2 = 'paper') then
        v_result := v_couple.partner_1_id::text;
      else
        v_result := v_couple.partner_2_id::text;
      end if;
    end if;
    v_state := jsonb_build_object(
      'round', coalesce((v_state->>'round')::integer, 1),
      'choices', v_choices,
      'result', case when v_result is null then 'null'::jsonb else to_jsonb(v_result) end
    );
  elsif v_game_type = 'couple_quiz' and v_action_type in ('answer', 'next_question') then
    v_answers := coalesce(v_state->'answers', '{}'::jsonb);
    v_scores := coalesce(v_state->'scores', '{}'::jsonb);
    v_question_index := coalesce((v_state->>'questionIndex')::integer, 0);
    if v_action_type = 'next_question' then
      if not coalesce((v_state->>'revealed')::boolean, false) then
        raise exception using errcode = '22023', message = 'Wait for both answers before continuing.';
      end if;
      v_answer := v_answers->>v_couple.partner_1_id::text;
      if v_answer is not null and v_answer = v_answers->>v_couple.partner_2_id::text then
        v_score_1 := coalesce((v_scores->>v_couple.partner_1_id::text)::integer, 0) + 1;
        v_score_2 := coalesce((v_scores->>v_couple.partner_2_id::text)::integer, 0) + 1;
        v_scores := jsonb_build_object(v_couple.partner_1_id::text, v_score_1, v_couple.partner_2_id::text, v_score_2);
      end if;
      v_question_index := (v_question_index + 1) % 5;
      v_answers := '{}'::jsonb;
      v_state := jsonb_build_object('questionIndex', v_question_index, 'answers', v_answers, 'scores', v_scores, 'revealed', false);
    else
      v_answer := p_action->>'answer';
      if v_answer is null or length(v_answer) > 80 or coalesce((v_state->>'revealed')::boolean, false)
         or v_answers ? v_user_id then
        raise exception using errcode = '22023', message = 'That answer cannot be submitted.';
      end if;
      v_answers := jsonb_set(v_answers, array[v_user_id], to_jsonb(v_answer), true);
      v_state := jsonb_build_object(
        'questionIndex', v_question_index,
        'answers', v_answers,
        'scores', v_scores,
        'revealed', v_answers ? v_couple.partner_1_id::text and v_answers ? v_couple.partner_2_id::text
      );
    end if;
  else
    raise exception using errcode = '22023', message = 'Unsupported game action.';
  end if;

  update public.couple_games
  set game_type = v_game_type,
      status = 'active',
      game_state = v_state,
      updated_by = auth.uid(),
      updated_at = now()
  where couple_id = p_couple_id
  returning * into v_game;

  return v_game;
end;
$$;

revoke all on function public.submit_couple_game_action(uuid, jsonb) from public;
grant execute on function public.submit_couple_game_action(uuid, jsonb) to authenticated;
