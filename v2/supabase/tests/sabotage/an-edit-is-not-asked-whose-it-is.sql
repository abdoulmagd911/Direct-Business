-- Sabotage: an-edit-is-not-asked-whose-it-is
-- Breaks: sql:OWN-02
-- Expect: nor moves their own invoice onto a colleague's client
-- An edit is not asked again, after the change, whose client the entry now is.
CREATE OR REPLACE FUNCTION finance.row_edit(p_table text, p_id uuid, p_fields jsonb, p_version integer, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  answer jsonb;
begin
  perform authz.require('finance', 'own');
  if p_table = 'invoice' and exists (select 1 from finance.invoice i where i.id = p_id and i.kind = 'billing') then
    raise exception using errcode = 'P0001', message = 'finance.edit_at_transaction_level',
      detail = (select i.ref from finance.invoice i where i.id = p_id);
  end if;
  -- Landing 56: the entry is the writer's own client's before the change, and still after it.
  perform finance.require_own(p_table, array[p_id]);
  answer := finance.row_edit_core(p_table, p_id, p_fields, p_version, p_reason);
  return answer;
end
$function$;
