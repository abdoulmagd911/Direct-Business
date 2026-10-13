-- Sabotage: a-template-runs-for-nobody
-- Breaks: sql:TPL-04
-- Expect: a daily template runs for someone
-- A scheduled template is switched on with no owner and no organisations to run for.
alter table work.task_template drop constraint template_runs_for_someone;
