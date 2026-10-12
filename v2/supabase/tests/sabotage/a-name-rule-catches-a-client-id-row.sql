-- Sabotage: a-name-rule-catches-a-client-id-row
-- Breaks: sql:EXC-01
-- Expect: the name rule leaves the client-ID row alone
-- A name rule catches a row that carries a client ID (V412).
create or replace function finance.exclusion_of(p_invoice uuid) returns finance.exclusion_rule
language sql stable security definer set search_path = ''
as $$
  select r.* from finance.exclusion_rule r
  join finance.invoice i on i.id = p_invoice
  left join lateral finance.partner_match(i.id) m on true
  where r.deleted_at is null
    and case r.kind
          when 'client_id' then i.client_id_key = r.value_key
          when 'tax_no' then i.tax_key = r.value_key
                             or exists (select 1 from partner.identifier d where d.deleted_at is null and d.kind in ('vat', 'cr')
                                        and d.value_key = r.value_key and d.partner_id = m.partner_id)
          when 'discount_code' then i.code_key = r.value_key
          when 'invoice' then norm.fold(i.ref) = r.value_key
          when 'product' then norm.fold(i.product_raw) = r.value_key
                              or exists (select 1 from finance.invoice_line l where l.invoice_id = i.id and l.deleted_at is null
                                         and norm.fold(l.product_raw) = r.value_key)
          when 'name' then (i.name_key = r.value_key or i.name2_key = r.value_key)
          when 'partner' then m.partner_id is not null
                              and r.value_key = norm.fold((select p.number from partner.partner p where p.id = m.partner_id))
          else false end
  order by case r.mode when 'hide' then 0 else 1 end, r.created_at
  limit 1
$$;
