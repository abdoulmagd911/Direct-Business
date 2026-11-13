-- ALR-05 — a broken alert is said once a day, and the others still run (the 13 Nov sweep): notify.generate_alerts
-- runs each alert on its own, but a failing one was only a warning in the server's log — the job still succeeded,
-- so an alert could stop for good unseen. The failure is now one job line in the change log ("alert.failed", naming
-- the alert and the error), once per alert per Riyadh day. Every value is made up.
create function notify.alert_zz_made_up_broken() returns setof notify.alert language plpgsql as $$
begin
  raise exception 'a made-up failure';
end
$$;

select notify.generate_alerts();
select notify.generate_alerts();
select test.eq((select count(*)::int from audit.request r
                where r.label_key = 'alert.failed' and r.happened_on = core.riyadh_today()
                  and r.label_args ->> 'alert' = 'alert_zz_made_up_broken'), 1,
  'the broken alert is said once, however often the job runs that day');
select test.eq((select r.kind from audit.request r
                where r.label_key = 'alert.failed' and r.label_args ->> 'alert' = 'alert_zz_made_up_broken'),
  'job', 'as a job line, where the whole change log shows it');
select test.ok((select r.label_args ->> 'error' from audit.request r
                where r.label_key = 'alert.failed' and r.label_args ->> 'alert' = 'alert_zz_made_up_broken')
               like '%a made-up failure%', 'naming the error');
