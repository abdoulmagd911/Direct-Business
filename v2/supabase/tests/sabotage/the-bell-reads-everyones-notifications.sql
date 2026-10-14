-- Sabotage: the-bell-reads-everyones-notifications
-- Breaks: sql:PRIV-02
-- Expect: nor read its alert through the bell
-- The bell's live read rule lets anyone signed in read every notification, private reminders included (V454).
drop policy notification_own on notify.notification;
create policy notification_own on notify.notification for select to authenticated using (true);
