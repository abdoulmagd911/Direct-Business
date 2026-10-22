-- Sabotage: anyone-logs-an-activity
-- Breaks: sql:ACT-01
-- Expect: a viewer logs nothing
-- Anyone who sees an organisation logs activities on it — a viewer too. (Updated for V645: the door now also takes the
-- ticket, the party inside Direct and the team share, so the write check is taken out of its current text.)
do $$
declare
  d text := pg_catalog.pg_get_functiondef(
    'partner.activity_log(uuid, text, text, date, text, text, date, uuid[], text, text, boolean)'::regprocedure);
  cut text := E'    if not core.may_write(e.table_name, p_partner) then\n      perform partner.side_writable(p_partner, null);\n    end if;\n';
begin
  if pg_catalog.strpos(d, cut) = 0 then
    raise exception 'the write check is not where this sabotage expects it';
  end if;
  execute pg_catalog.replace(d, cut, '');
end
$$;
