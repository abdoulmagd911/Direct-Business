-- Sabotage: a-second-issue-gets-a-second-answer
-- Breaks: sql:RPT-01
-- Expect: a second Issue answers with its number
-- A second Issue no longer answers "Already issued as <number>" (OLD-052).
create or replace function report.issue(p_report uuid, p_version int) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  r report.report;
  langs text[];
  missing record;
  snap jsonb;
  num text;
  flags jsonb;
  req uuid;
begin
  select * into r from report.report x where x.id = p_report and x.deleted_at is null for update;
  if r.id is null or not report.sees(me, r.department_id) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'report.report';
  end if;
  -- a second Issue answers with the number it was issued as (OLD-052)
  if false and r.status in ('issued', 'superseded') then
    raise exception using errcode = 'P0001', message = 'report.already_issued', detail = r.number;
  end if;
  r := report.draft_for_edit(p_report, me);
  perform core.check_version('report.report', r.id, p_version, '{}'::text[]);
  if r.supersedes_id is null and exists (select 1 from report.report x
                                         where x.department_id = r.department_id and x.kind = r.kind
                                           and x.period_start = r.period_start and x.status = 'issued') then
    raise exception using errcode = 'P0001', message = 'report.already_issued',
      detail = (select x.number from report.report x where x.department_id = r.department_id and x.kind = r.kind
                  and x.period_start = r.period_start and x.status = 'issued');
  end if;
  -- every line has its text in each language the template prints (V403)
  langs := (select t.print_languages from report.template t where t.id = r.template_id);
  select l.section_key, l.sort, g.lang into missing
  from report.line l, pg_catalog.unnest(langs) g(lang)
  where l.report_id = r.id and l.deleted_at is null
    and pg_catalog.btrim(coalesce(case g.lang when 'ar' then l.text_ar else l.text_en end, '')) = ''
  order by l.section_key, l.sort
  limit 1;
  if missing.sort is not null then
    raise exception using errcode = 'P0001', message = 'report.line_missing_language',
      detail = missing.section_key || ':' || missing.sort || ':' || missing.lang;
  end if;
  snap := report.snapshot_of(r);
  num := report.number_for(r);
  -- a banned word in a line is flagged at issue, never silently kept (OLD-PRF-067, V404)
  flags := coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('section', l.section_key, 'place', l.sort,
                                                                                'word', w.word) order by l.section_key, l.sort)
                     from report.line l
                     cross join lateral (select coalesce(core.banned_word(l.text_en), core.banned_word(l.text_ar)) as word) w
                     where l.report_id = r.id and l.deleted_at is null and w.word is not null), '[]'::jsonb);
  req := audit.begin('ui', 'report.issued', pg_catalog.jsonb_build_object('number', num));
  update report.report x set status = 'superseded', updated_at = pg_catalog.now(), updated_by = me, version = x.version + 1
  where x.id = r.supersedes_id and x.status = 'issued';
  update report.report x set status = 'issued', number = num, issued_at = pg_catalog.now(), issued_by = me, snapshot = snap,
         snapshot_sha256 = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(snap::text, 'UTF8')), 'hex'),
         updated_at = pg_catalog.now(), updated_by = me, version = x.version + 1
  where x.id = r.id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', r.id, 'number', num, 'flags', flags, 'request_id', req);
end
$$;
