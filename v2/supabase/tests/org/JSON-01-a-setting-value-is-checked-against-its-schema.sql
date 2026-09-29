-- JSON-01 — a setting's value is checked against its own schema, in the database (V131): every registry setting accepts
-- its default and refuses a value of the wrong shape; bounds, enums, array items and objects are checked; a schema using
-- a keyword the database does not check is refused rather than half-checked.
-- Sabotage: supabase/tests/sabotage/the-schema-checks-only-the-type.sql.
do $$
declare
  d record;
begin
  for d in select key, schema, default_value from core.setting_def where active loop
    perform test.eq(core.json_check(d.schema, d.default_value), null::text, format('%s accepts its default', d.key));
  end loop;
end $$;

select test.eq(core.json_check((select schema from core.setting_def where key = 'audit.undo_window_hours'), '12'),
  null::text, 'a whole number within bounds fits');
select test.ok(core.json_check((select schema from core.setting_def where key = 'audit.undo_window_hours'), '0')
  like '%too small%', 'below the minimum is refused');
select test.ok(core.json_check((select schema from core.setting_def where key = 'audit.undo_window_hours'), '200')
  like '%too large%', 'above the maximum is refused');
select test.ok(core.json_check((select schema from core.setting_def where key = 'audit.undo_window_hours'), '1.5')
  like '%expected integer%', 'a fraction is not a whole number');
select test.ok(core.json_check((select schema from core.setting_def where key = 'audit.undo_window_hours'), '"12"')
  like '%expected integer%', 'text is not a number');
select test.ok(core.json_check((select schema from core.setting_def where key = 'app.default_theme'), '"neon"')
  like '%not one of%', 'a value outside its list is refused');
select test.ok(core.json_check((select schema from core.setting_def where key = 'app.export_formats'), '[]')
  like '%too few items%', 'an empty list where one is required is refused');
select test.ok(core.json_check((select schema from core.setting_def where key = 'app.export_formats'), '["csv", "pdf"]')
  like '$[1]: not one of%', 'each item of a list is checked, and the answer says which');
select test.ok(core.json_check('{"type": "object", "required": ["a"], "properties": {"a": {"type": "string"}},
                                 "additionalProperties": false}', '{"a": "x", "b": 1}') like '%"b" is not allowed%',
  'an object refuses a key its schema does not allow');
select test.ok(core.json_check('{"type": "object", "required": ["a"]}', '{}') like '%missing a%',
  'and asks for the keys it requires');
select test.ok(core.json_check('{"anyOf": [{"type": "string"}]}', '"x"') like '%does not check%',
  'a schema using a keyword the database does not check is refused');
