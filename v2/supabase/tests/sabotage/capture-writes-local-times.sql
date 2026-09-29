-- Sabotage: capture-writes-local-times
-- Breaks: sql:UNDO-04
-- Expect: a removal undone restores the row, whatever the time zone
-- The change log writes times in the session's time zone, so an undo in another zone sees a change that never happened.
alter function audit.capture() reset timezone;
