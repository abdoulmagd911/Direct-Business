-- Sabotage: history-shows-every-follow-up
-- Breaks: sql:HIST-02
-- Expect: a colleague who sees the task does not see the owner's follow-up
-- A record's history shows every follow-up on it, not only the reader's own (B, V454): a private reminder is read by
-- whoever may open the record.
do $$
declare
  d text := pg_catalog.pg_get_functiondef('audit.record_history(text, uuid)'::regprocedure);
  rule text := 'r.person_id = me';
begin
  if pg_catalog.strpos(d, rule) = 0 then
    raise exception 'the follow-up rule is not where this sabotage expects it';
  end if;
  execute pg_catalog.replace(d, rule, 'true');
end
$$;
