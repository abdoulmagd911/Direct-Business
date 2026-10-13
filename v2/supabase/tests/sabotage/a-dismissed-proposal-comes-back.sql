-- Sabotage: a-dismissed-proposal-comes-back
-- Breaks: sql:IMP-11
-- Expect: a dismissed proposal is not proposed again
-- A set a person dismissed is proposed again by the next file (QA-539, V622).
create or replace function finance.set_dismissed(p_billing uuid, p_ids uuid[]) returns boolean
language sql stable set search_path = ''
as $$
  select false and exists (select 1 from finance.billing_proposal p
                 where p.billing_invoice_id = p_billing and p.state = 'dismissed' and p.deleted_at is null
                   and p.transaction_ids @> p_ids and p.transaction_ids <@ p_ids)
$$;
