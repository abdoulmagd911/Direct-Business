-- Mutant m60-next-step-before-it: a next step may come before the activity
alter table core.note drop constraint note_next_step_after;
