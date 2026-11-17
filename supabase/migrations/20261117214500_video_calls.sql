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
