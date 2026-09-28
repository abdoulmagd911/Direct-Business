-- D24 starting lists — the owner's main services and the Payments products' default services, as the oversight wrote them
-- (28 Sep). Settings, not business records; applied only on the oversight's word, and each row is logged as the QA account
-- (D13). Every entry can be changed or removed on Finance → Rules afterwards. Running it twice adds nothing.
insert into public.money_services (name, sort_order, counts_as_income)
select v.name, v.s, v.c from (values ('Flights', 10, true), ('Hotels', 20, true), ('Transportation', 30, true), ('Visas', 40, true),
  ('Study abroad', 50, true), ('Packages', 60, true), ('Journey Solutions', 70, true), ('Other income', 80, true),
  ('Not income (never counted)', 900, false)) v(name, s, c)
where not exists (select 1 from public.money_services x where x.removed_at is null and x.name_norm = public.money_norm(v.name));

insert into public.money_product_services (product, service_id)
select v.p, s.id from (values ('Direct Flights', 'Flights'), ('Direct Hotels', 'Hotels'), ('Direct Visa', 'Visas'), ('Direct Course', 'Study abroad'),
  ('Direct Packages', 'Packages'), ('Journey Solutions', 'Journey Solutions'), ('Other Income', 'Other income'),
  ('Direct Wallet', 'Not income (never counted)')) v(p, sv)
join public.money_services s on s.removed_at is null and s.name_norm = public.money_norm(v.sv)
where not exists (select 1 from public.money_product_services x where x.removed_at is null and x.product_norm = public.money_norm(v.p));
