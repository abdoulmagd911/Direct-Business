-- Mutant m59-next-step-without-day: a next step is kept without its day
alter table core.note drop constraint note_next_step_has_day;
