-- Sabotage: a-pressed-renewal-task-is-not-linked
-- Breaks: sql:CTR-04
-- Expect: never a second while one is open
-- Create renewal task makes a task the contract never points to, so it can be pressed again and again. The only
-- defect is the missing link: the P1b Assign gate (Landing 3, 20261109000021) is kept, so a member without Assign
-- is still refused and the test reaches the second press instead of going red on the gate.
create or replace function work.contract_renewal_task(p_contract uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  c partner.contract;
  req uuid;
  t jsonb;
begin
  select * into c from partner.contract k where k.id = p_contract and k.deleted_at is null;
  if c.id is null or not authz.can_see_as(me, 'partner.contract', c.id) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform partner.side_writable(c.partner_id, c.side);
  if c.end_on is null then
    raise exception using errcode = 'P0001', message = 'contract.renewal_needs_end_date';
  end if;
  if exists (select 1 from work.task k join work.task_status s on s.id = k.status_id
             where k.id = c.renewal_task_id and k.deleted_at is null and s.meaning not in ('done', 'cancelled')) then
    raise exception using errcode = 'P0001', message = 'contract.renewal_task_open', detail = c.renewal_task_id::text;
  end if;
  -- P1b: the renewal task belongs to the account manager, not to whoever pressed the button.
  if work.renewal_owner(c) is distinct from me and not authz.can('tasks.assign') then
    raise exception using errcode = '42501', message = 'access.needs_capability', detail = 'tasks.assign';
  end if;
  req := audit.begin('ui', 'task.renewal_created', pg_catalog.jsonb_build_object('contract', c.title));
  t := work.task_create(pg_catalog.jsonb_build_object('title', work.renewal_title(c), 'type', 'follow_up',
         'owner_id', coalesce(work.renewal_owner(c), me), 'due_on', c.end_on, 'partner_id', c.partner_id));
  perform audit.end();
  return t || pg_catalog.jsonb_build_object('request_id', req);
end
$$;
