-- An organisation's credit and wallet (spec §3.6 partner_credit, partner_wallet; V70, V617). partner_credit: the credit
-- limit in force today (the newest whose effective day has come), who approved it and from when, and what is owed
-- against it (the receivables, V416): available and over the limit. partner_wallet: paid wallet top-ups less the wallet
-- part of its counted invoices — an internal check only (V617: Payments wallets hold drafts and cancelled transactions
-- and are reconciled by hand), so no read door shows it as money.

create view finance.partner_credit with (security_invoker = true) as
with lim as (
  select distinct on (c.partner_id) c.partner_id, c.amount_sar, c.effective_from, c.approved_by
  from partner.credit_limit c
  where c.deleted_at is null and c.effective_from <= core.riyadh_today()
  order by c.partner_id, c.effective_from desc, c.created_at desc
)
select l.partner_id, l.amount_sar as credit_limit, l.effective_from, l.approved_by,
       coalesce(o.outstanding, 0) as outstanding, l.amount_sar - coalesce(o.outstanding, 0) as available,
       coalesce(o.outstanding, 0) > l.amount_sar as over_limit
from lim l
left join (select r.partner_id, sum(r.outstanding) as outstanding from finance.receivable r
           where r.partner_id is not null group by r.partner_id) o on o.partner_id = l.partner_id;
comment on view finance.partner_credit is 'V70: the credit limit in force, its approver, and what is owed against it (V416).';

create view finance.partner_wallet with (security_invoker = true) as
select f.partner_id,
       coalesce(sum(f.total_sar) filter (where f.kind = 'wallet_topup' and f.pay_state = 'paid'), 0) as topped_up,
       coalesce(sum(f.wallet_sar) filter (where f.kind <> 'wallet_topup' and f.pay_state = 'paid'), 0) as consumed,
       coalesce(sum(f.total_sar) filter (where f.kind = 'wallet_topup' and f.pay_state = 'paid'), 0)
         - coalesce(sum(f.wallet_sar) filter (where f.kind <> 'wallet_topup' and f.pay_state = 'paid'), 0) as balance_check
from finance.invoice_fact f
where f.partner_id is not null
group by f.partner_id;
comment on view finance.partner_wallet is 'V70, V617: paid top-ups − the wallet part of paid invoices — an internal check only, never shown as money.';

-- An organisation's credit, for its card (Finance view level): none when it has no limit in force.
create function finance.partner_credit_of(p_partner uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('finance', 'view');
  return (select pg_catalog.to_jsonb(c) - 'partner_id' from finance.partner_credit c where c.partner_id = p_partner);
end
$$;
create function api.finance_partner_credit(p_partner uuid) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.partner_credit_of(p_partner) $$;

revoke all on function finance.partner_credit_of(uuid) from public;
grant execute on function finance.partner_credit_of(uuid) to authenticated;
grant execute on function api.finance_partner_credit(uuid) to authenticated;
