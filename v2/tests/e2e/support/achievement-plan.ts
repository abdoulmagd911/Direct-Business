import { sql } from './stack';

/**
 * Makes sure this year's Commercial plan and its achievement categories exist, so a spec that logs an achievement does
 * not lean on another spec having made them first (the sabotage runs start from an empty database).
 */
export async function ensureAchievementPlan() {
  await sql(
    `insert into core.department (code, name_en, name_ar) values ('commercial', 'Commercial', 'التجاري') on conflict (code) do nothing`,
  );
  await sql(
    `do $$
     declare
       d uuid := (select id from core.department where code = 'commercial');
       y int := extract(year from now() at time zone 'Asia/Riyadh')::int;
       p uuid;
     begin
       if perf.plan_of(d, y) is null then
         begin
           insert into perf.plan (department_id, year, name) values (d, y, 'Made-up plan ' || y) returning id into p;
           perform perf.categories_seed(p);
         exception when unique_violation then null;
         end;
       end if;
     end $$`,
  );
}
