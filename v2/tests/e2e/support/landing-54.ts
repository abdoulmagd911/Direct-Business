/**
 * Landing 54 (KPI pace) · what its two browser specs share: a made-up department of its own — so the KPIs on the
 * page are this test's alone, whatever other specs do to the shared plans — with a manager, a member and a viewer in
 * it, a plan, three targets in the month that has just ended (a finished month is judged on its whole target, so its
 * figures do not move with the day the test runs) and one in the current month. Every value is made up.
 */
import { expect, type Browser, type Page } from '@playwright/test';
import { doorOf, hydrated, personAs, signedInAs, tag, today, type Door } from './landing-32';
import { signIn, sql, type TestPerson } from './stack';

export type PaceSeed = {
  admin: TestPerson;
  manager: TestPerson;
  member: TestPerson;
  viewer: TestPerson;
  /** `YYYY-MM` of the month that has just ended, and of the current one. */
  last: string;
  now: string;
  planId: string;
  project: string;
  /** The plan's categories by code. */
  categories: Record<string, string>;
  asManager: Door;
  close: () => Promise<void>;
};

const shift = (month: string, by: number) => {
  const at = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + by;
  return `${Math.floor(at / 12)}-${String((at % 12) + 1).padStart(2, '0')}`;
};

export async function seedPace(page: Page, browser: Browser): Promise<PaceSeed> {
  const t = tag();
  const [dept] = await sql<{ id: string }>(
    `insert into core.department (code, name_en, name_ar) values ($1, $2, $3) returning id`,
    [`pace_${t}`, `Made Up Pace Department ${t}`, `قسم الوتيرة ${t}`],
  );
  const [team] = await sql<{ id: string }>(
    `insert into core.team (department_id, code, name_en, name_ar) values ($1, $2, $3, $4) returning id`,
    [dept!.id, `pace_${t}`, `Made Up Pace Team ${t}`, `فريق الوتيرة ${t}`],
  );
  const admin = await personAs('admin');
  const [manager, member, viewer] = await Promise.all([personAs('manager'), personAs('member'), personAs('viewer')]);
  await sql(`update core.person set department_id = $1, team_id = $2 where id = any($3::uuid[])`, [
    dept!.id,
    team!.id,
    [manager!.id, member!.id, viewer!.id],
  ]);
  await sql(`update core.person set full_name_ar = $2 where id = $1`, [member!.id, `عضو تجريبي ${t}`]);

  await signIn(page, admin.email, '/my-day');
  await hydrated(page);
  const asAdmin = doorOf(page.context());
  const now = today().slice(0, 7);
  const last = shift(now, -1);
  // the two months are in one plan, except in January: then last month's plan is last year's
  const plans: Record<string, string> = {};
  for (const y of new Set([last.slice(0, 4), now.slice(0, 4)]))
    plans[y] = (await asAdmin<{ id: string }>('plan_open', { p_department: dept!.id, p_year: Number(y) })).id;
  const planId = plans[last.slice(0, 4)]!;
  const cats = await asAdmin<{ id: string; code: string }[]>('achievement_categories', { p_plan: planId });
  const categories = Object.fromEntries(cats.map((c) => [c.code, c.id]));
  const target = (plan: string, category: string, month: string, values: Record<string, unknown>) =>
    asAdmin('target_save', { p_id: null, p_plan: plan, p_values: { category, month: `${month}-01`, ...values } });
  await target(planId, categories.PROBLEM!, last, { target_count: 4 });
  await target(planId, categories.CONTRACT!, last, { target_count: 5, target_value: 10000 });
  const nowPlan = plans[now.slice(0, 4)]!;
  const nowCats =
    nowPlan === planId
      ? categories
      : Object.fromEntries(
          (await asAdmin<{ id: string; code: string }[]>('achievement_categories', { p_plan: nowPlan })).map((c) => [
            c.code,
            c.id,
          ]),
        );
  await target(nowPlan, nowCats.PROBLEM!, now, { target_count: 6 });

  const m = await signedInAs(browser, manager!);
  const asManager = doorOf(m.context);
  const project = `Made-up initiative ${t}`;
  const prj = await asManager('project_save', { p_id: null, p_values: { name: project, work_type: 'internal' } });
  const task = await asManager('task_create', {
    p_values: { title: `Made-up initiative task ${t}`, work_type: 'internal', project_id: prj.id },
  });
  const log = (values: Record<string, unknown>) => asManager('achievement_log', { p_values: values });
  for (const [i, day] of ['03', '08', '14', '21'].entries())
    await log({
      category: 'PROBLEM',
      title: `Made-up fix ${t} ${i + 1}`,
      happened_on: `${last}-${day}`,
      ...(i === 0 ? { source_task_id: task.id } : {}),
    });
  for (const [i, value] of [3000, 1000, 500, 500].entries())
    await log({
      category: 'CONTRACT',
      title: `Made-up contract ${t} ${i + 1}`,
      happened_on: `${last}-${String(5 + i * 5).padStart(2, '0')}`,
      deal_value: value,
    });
  const set = await asManager<{ person_id: string }>('kpi_responsible_set', {
    p_plan: planId,
    p_category: categories.PROBLEM,
    p_person: member!.id,
  });
  expect(set.person_id).toBe(member!.id);
  return {
    admin,
    manager: manager!,
    member: member!,
    viewer: viewer!,
    last,
    now,
    planId,
    project,
    categories,
    asManager,
    close: () => m.context.close(),
  };
}
