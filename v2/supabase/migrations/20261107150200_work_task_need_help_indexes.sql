-- Phase 5 (Need help): every foreign key needs its own leading-column index (FK-01). The 20261107150000
-- migration added escalated_by / escalated_to to work.task with only the composite (escalated, escalated_to)
-- index, which leads on escalated and leaves escalated_by uncovered.
create index if not exists task_escalated_by on work.task (escalated_by);
create index if not exists task_escalated_to_fk on work.task (escalated_to);
