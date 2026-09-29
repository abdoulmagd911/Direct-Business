-- Sabotage: a-removed-mention-is-deleted
-- Breaks: sql:NOTE-01
-- Expect: but is kept, marked removed
-- A mention taken off a note is deleted, not kept (V401).
create or replace function core.note_edit(p_id uuid, p_values jsonb, p_version int, p_mentions uuid[] default null)
  returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  n core.note;
  v jsonb := coalesce(p_values, '{}');
  k text;
  t partner.activity_type;
  o partner.activity_outcome;
  req uuid;
  what text;
begin
  select * into n from core.note where id = p_id and deleted_at is null;
  if me is null or n.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if n.created_by <> me then
    raise exception using errcode = '42501', message = 'note.not_yours';
  end if;
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('body', 'happened_on', 'outcome', 'next_step', 'next_step_on')
       or (n.kind <> 'activity' and k in ('outcome', 'next_step', 'next_step_on')) then
      raise exception using errcode = 'P0001', message = 'note.unknown_field', detail = k;
    end if;
  end loop;
  if v ? 'body' then
    v := v || pg_catalog.jsonb_build_object('body', nullif(pg_catalog.btrim(v ->> 'body'), ''));
  end if;
  if v ? 'next_step' then
    v := v || pg_catalog.jsonb_build_object('next_step', nullif(pg_catalog.btrim(v ->> 'next_step'), ''));
  end if;
  if v ? 'outcome' then
    select * into t from partner.activity_type where id = n.activity_type_id;
    o := partner.outcome_of(t, v ->> 'outcome');
    v := (v - 'outcome') || pg_catalog.jsonb_build_object('outcome_id', o.id);
  end if;
  perform core.check_version('core.note', p_id, p_version,
    (select pg_catalog.array_agg(x) from pg_catalog.jsonb_object_keys(v) x where (pg_catalog.to_jsonb(n) -> x) is distinct from (v -> x)));
  req := audit.begin('ui', 'note.edited', pg_catalog.jsonb_build_object('kind', n.kind), null);
  begin
    perform audit.write_fields('core.note', p_id, v || pg_catalog.jsonb_build_object('edited_at', core.clock()));
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = core.note_refused(what);
  end;
  if p_mentions is not null then
    delete from core.mention where note_id = p_id and not (person_id = any (p_mentions));
    perform core.mentions_add(p_id, p_mentions);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'version', (select x.version from core.note x where x.id = p_id),
                                       'request_id', req);
end
$$;
