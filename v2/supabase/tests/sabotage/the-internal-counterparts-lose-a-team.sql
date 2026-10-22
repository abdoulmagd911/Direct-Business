-- Sabotage: the-internal-counterparts-lose-a-team
-- Breaks: sql:LIST-02
-- Expect: the internal list: Operations, Product, Website and app developers, Support, in that order
-- The seeded internal list is missing its Support team.
update partner.internal_counterpart set deleted_at = core.clock(), deleted_by = (select id from core.person order by created_at limit 1),
  delete_reason = 'sabotage' where key = 'support';
