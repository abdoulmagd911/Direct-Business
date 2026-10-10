-- Sabotage: an-old-invoice-keeps-a-client-active
-- Breaks: sql:CLC-01
-- Expect: three sign-ups, two onboarded, one active: an invoice 120 days old does not keep a client active
-- A client stays active on any counted invoice, however old, not one inside the active days (V477).
create or replace function partner.client_rows(p_on date)
  returns table (partner_id uuid, segment_key text, onboarded boolean, active boolean, owner_id uuid, team_id uuid,
                 department_id uuid)
language sql stable security definer set search_path = ''
as $$
  select s.partner_id, t.key,
         exists (select 1 from partner.side_status_change c
                 where c.partner_id = s.partner_id and c.side = 'client' and c.deleted_at is null and c.status = 'active'
                   and c.effective_on <= p_on),
         exists (select 1 from finance.money_row r
                 where r.counted and r.partner_id = s.partner_id
                   and r.created_on <= p_on),
         o.person_id, pe.team_id, pe.department_id
  from partner.partner_side s
  join partner.partner p on p.id = s.partner_id and p.archived_at is null and p.merged_into_id is null
  join partner.side_type t on t.id = s.type_id
  left join lateral (select x.person_id from partner.side_owner x
                     where x.partner_id = s.partner_id and x.side = 'client' and x.deleted_at is null
                       and x.effective_from <= p_on and (x.effective_to is null or p_on < x.effective_to)
                     order by x.effective_from desc limit 1) o on true
  left join core.person pe on pe.id = o.person_id
  where s.side = 'client' and s.deleted_at is null and (s.since is null or s.since <= p_on)
    and (s.until is null or s.until > p_on)
$$;
