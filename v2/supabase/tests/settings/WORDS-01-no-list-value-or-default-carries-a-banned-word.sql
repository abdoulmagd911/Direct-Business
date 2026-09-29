-- WORDS-01 — the banned words cover the data too (V404, V156): on the database built from zero, no value of any setting
-- list, no setting default and no wording carries a name the app never says — the segment is Government, never with
-- "B2G" after it; the list editor refuses a value that carries one, adding or renaming, and names it; so does the
-- side-field editor, in a label or an option. Every value is made up.
-- Sabotages: supabase/tests/sabotage/the-list-editor-takes-a-banned-word.sql, supabase/tests/sabotage/a-banned-seed.sql.
do $$
declare
  e record;
  bad text;
begin
  for e in select x.key, x.table_name from core.entity x where x.is_list and x.active order by x.key loop
    execute format('select core.banned_word(to_jsonb(t)::text) from %s t where core.banned_word(to_jsonb(t)::text) is not null'
                   || ' limit 1', e.table_name) into bad;
    perform test.eq(bad, null::text, format('the list %s carries no banned word', e.key));
  end loop;
  perform test.eq((select string_agg(d.key, ', ') from core.setting_def d
                   where d.active and core.banned_word(d.default_value::text) is not null), null::text,
    'no setting default carries a banned word');
  perform test.eq((select string_agg(s.key, ', ') from core.setting s
                   where s.deleted_at is null and core.banned_word(s.value::text) is not null), null::text,
    'nor any setting value');
  perform test.eq((select string_agg(w.key, ', ') from core.wording w where core.banned_word(to_jsonb(w)::text) is not null),
    null::text, 'nor any wording');
  perform test.eq((select name_en from partner.side_type where side = 'client' and key = 'government'), 'Government',
    'the segment is Government');
end $$;

select test.eq(core.banned_word('Government (B2G)'), 'B2G', 'a banned word is named');
select test.eq(core.banned_word('a b-2-b desk'), 'B2B', 'however it is spaced');
select test.eq(core.banned_word('Direct KSA travel'), 'Direct KSA', 'or cased');
select test.eq(core.banned_word('Government · Corporate · microphone · zooming'), null::text, 'ordinary words pass');

select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.gov', (select id::text from partner.side_type where side = 'client' and key = 'government'), true);
select set_config('t.gv', (select version::text from partner.side_type where side = 'client' and key = 'government'), true);
select test.as_person(current_setting('t.admin')::uuid);
select test.raises($$select api.list_save('side_type', null,
  '{"side": "client", "key": "made_up_gov", "name_en": "Government (B2G)", "name_ar": "حكومي"}')$$, 'P0001',
  'the list editor refuses a value that carries a banned word', 'list.banned_word');
select test.raises(format('select api.list_save(%L, %L, %L, %s)', 'side_type', current_setting('t.gov'),
  '{"name_en": "Government (B2G)"}', current_setting('t.gv')), 'P0001', 'renaming too', 'list.banned_word');
select test.ok((api.list_save('side_type', current_setting('t.gov')::uuid, '{"name_en": "Government sector"}',
                current_setting('t.gv')::int) ->> 'id') is not null, 'an ordinary name is saved');
select test.raises($$select api.side_field_save(null, '{"side": "supplier_partner", "key": "made_up_link",
  "label_en": "Zoom link", "label_ar": "رابط", "type": "text"}')$$, 'P0001', 'the side-field editor refuses one in a label',
  'list.banned_word');
select test.raises($$select api.side_field_save(null, '{"side": "client", "key": "made_up_kind", "label_en": "Kind",
  "label_ar": "النوع", "type": "select", "options": [{"key": "b2g", "en": "B2G", "ar": "حكومي"}]}')$$, 'P0001',
  'and in an option', 'list.banned_word');
