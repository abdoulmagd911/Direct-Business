-- Sabotage: a-task-coming-due-told-twice-a-day
-- Breaks: sql:ALR-04
-- Expect: nothing new was made
-- A task whose due day moves is told again the same day: no unique key keeps "coming due" to once a day.
drop index notify.notification_due_once_a_day;
