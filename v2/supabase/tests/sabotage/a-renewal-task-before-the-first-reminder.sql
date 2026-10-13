-- Sabotage: a-renewal-task-before-the-first-reminder
-- Breaks: sql:CTR-04
-- Expect: today: one renewal task, for the contract at its first reminder
-- A contract added after its first reminder days gets its renewal task at once, not at its first reminder.
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
                where c.end_on - d <= p_day)
    and c.renewal_end_on is distinct from c.end_on
    and not exists (select 1 from work.task k join work.task_status s on s.id = k.status_id
                    where k.id = c.renewal_task_id and k.deleted_at is null and s.meaning not in ('done', 'cancelled'))
$$;
