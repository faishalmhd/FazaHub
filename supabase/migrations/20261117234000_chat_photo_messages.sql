alter table public.couple_messages add column if not exists image_url text;

alter table public.couple_messages drop constraint if exists couple_messages_body_check;
alter table public.couple_messages add constraint couple_messages_body_check
  check (length(trim(body)) between 0 and 2000);

alter table public.couple_messages drop constraint if exists couple_messages_content_present;
alter table public.couple_messages add constraint couple_messages_content_present
  check (length(trim(body)) > 0 or image_url is not null);
