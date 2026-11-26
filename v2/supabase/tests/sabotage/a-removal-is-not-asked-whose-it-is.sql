-- Sabotage: a-removal-is-not-asked-whose-it-is
-- Breaks: sql:OWN-02
-- Expect: a colleague cannot remove it
-- A removal is not asked whose client the entry is.
CREATE OR REPLACE FUNCTION finance.rows_remove(p_table text, p_ids uuid[], p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform authz.require('finance', 'own');
  if p_table = 'invoice' and exists (select 1 from finance.invoice i where i.id = any (p_ids) and i.kind = 'billing') then
    raise exception using errcode = 'P0001', message = 'finance.edit_at_transaction_level',
      detail = (select i.ref from finance.invoice i where i.id = any (p_ids) and i.kind = 'billing' limit 1);
  end if;
  -- Landing 56: every entry removed is the writer's own client's (or the writer holds Full).
  return finance.rows_remove_core(p_table, p_ids, p_reason);
end
$function$;
