-- Sabotage: the-renewal-task-is-made-twice
-- Breaks: sql:CTR-04
-- Expect: a second run the same day makes nothing
-- Each run of the job makes a contract's renewal task again.
create or replace function work.renewal_due(c partner.contract, p_day date) returns boolean
language sql stable security definer set search_path = ''
as $$
  select c.deleted_at is null and c.reminders_on and c.end_on is not null and c.end_on >= p_day
    and partner.side_on(c.partner_id, c.side)
    and exists (select 1 from partner.partner p
                where p.id = c.partner_id and p.deleted_at is null and p.archived_at is null)
    and exists (select 1 from pg_catalog.unnest(coalesce(c.reminder_days, (
                  select pg_catalog.array_agg(x::int) from pg_catalog.jsonb_array_elements_text(
                    core.setting_at('partner.contract_reminder_days', null, p_day)) x))) d
                where c.end_on - d <= p_day and c.end_on - d >= core.riyadh_day(c.created_at))
$$;
