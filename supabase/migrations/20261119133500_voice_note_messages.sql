alter table public.couple_messages
  add column if not exists audio_url text,
  add column if not exists audio_duration integer;

alter table public.couple_messages
  drop constraint if exists couple_messages_content_present;
alter table public.couple_messages
  add constraint couple_messages_content_present
  check (length(trim(body)) > 0 or image_url is not null or audio_url is not null);

alter table public.couple_messages
  drop constraint if exists couple_messages_audio_duration_check;
alter table public.couple_messages
  add constraint couple_messages_audio_duration_check
  check (
    (audio_url is null and audio_duration is null)
    or (audio_url is not null and audio_duration between 1 and 120)
  );
