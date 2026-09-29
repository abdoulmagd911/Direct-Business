-- Sabotage: a-suppliers-contract-shows-to-clients
-- Breaks: sql:CTR-03
-- Expect: and sees only its own side
-- An organisation's contracts show to whoever sees it, whichever side they are on.
create or replace function partner.contracts(p_partner uuid, p_side text default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := partner.require_level(p_partner, null, 'view');
  days jsonb := core.setting_at('partner.contract_reminder_days', null, core.riyadh_today());
begin
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', c.id, 'side', c.side, 'kind', c.kind, 'title', c.title, 'start_on', c.start_on, 'end_on', c.end_on,
      'reminders_on', c.reminders_on, 'reminder_days', c.reminder_days,
      'reminder_days_in_force', case when c.reminders_on and c.end_on is not null
                                     then coalesce(pg_catalog.to_jsonb(c.reminder_days), days) else '[]'::jsonb end,
      'renewal_task_id', c.renewal_task_id, 'notes', c.notes, 'version', c.version,
      'terms', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', t.id, 'term', tm.key, 'name_en', tm.name_en, 'name_ar', tm.name_ar, 'unit', tm.unit,
          'before', t.value_before, 'after', t.value_after, 'achievement_id', t.achievement_id,
          'logged', t.achievement_id is not null, 'version', t.version) order by tm.sort, tm.key)
        from partner.contract_term t join partner.term tm on tm.id = t.term_id
        where t.contract_id = c.id and t.deleted_at is null), '[]'::jsonb),
      'files', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', f.id, 'purpose', l.purpose, 'display_name_en', core.file_display_name(f.id, 'en'),
          'display_name_ar', core.file_display_name(f.id, 'ar'), 'mime', f.mime, 'size_bytes', f.size_bytes,
          'sensitivity', f.sensitivity) order by f.created_at, f.id)
        from core.file_link l join core.file f on f.id = l.file_id
        where l.entity_table = 'partner.contract' and l.entity_id = c.id and l.deleted_at is null
          and f.deleted_at is null and authz.file_visible(f.id)), '[]'::jsonb))
      || partner.contract_state(c.start_on, c.end_on)
      order by c.start_on desc, c.id)
    from partner.contract c
    where c.partner_id = p_partner and c.deleted_at is null and (p_side is null or c.side = p_side)), '[]'::jsonb);
end
$$;
