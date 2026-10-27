-- Sabotage: past-work-fixed-when-logged
-- Breaks: sql:PAST-02
-- Expect: the closed task of 2 Oct is now under Past work
-- Past work reads the go-live day as it stood on the entry's own day, as if it were stored when the entry was made
-- (V609): setting the day later never moves earlier entries into Past work.
do $$
declare
  d text := pg_catalog.pg_get_functiondef('work.is_past(date)'::regprocedure);
  rule text := 'core.setting_at(''app.go_live_on'', null, core.riyadh_today())';
begin
  if pg_catalog.strpos(d, rule) = 0 then
    raise exception 'the go-live read is not where this sabotage expects it';
  end if;
  execute pg_catalog.replace(d, rule, 'core.setting_at(''app.go_live_on'', null, p_on)');
end
$$;
