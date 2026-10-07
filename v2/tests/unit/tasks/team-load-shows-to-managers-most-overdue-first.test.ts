import { describe, expect, it } from 'vitest';
import { byLoad, showsTeamLoad } from '@/modules/tasks/rules';

// Made-up people (rule 7). The team's load (V91) shows on Tasks › Team to someone who gives work to others, and puts
// whoever needs help first.
const row = (name: string, overdue: number, open: number) => ({ full_name_en: name, overdue, open_tasks: open });

describe("the team's load: managers see it on the Team view, the most overdue first (V91)", () => {
  it('shows only on the Team view, and only with tasks.assign', () => {
    expect(showsTeamLoad('team', ['tasks.assign'])).toBe(true);
    expect(showsTeamLoad('team', [])).toBe(false);
    expect(showsTeamLoad('my_work', ['tasks.assign'])).toBe(false);
    expect(showsTeamLoad('past', ['tasks.assign'])).toBe(false);
  });

  it('the most overdue first, then the most open work, then by name', () => {
    const rows = [row('Hana', 0, 9), row('Badr', 2, 1), row('Amal', 0, 9), row('Dana', 2, 4), row('Ziad', 0, 0)];
    expect(byLoad(rows).map((r) => r.full_name_en)).toEqual(['Dana', 'Badr', 'Amal', 'Hana', 'Ziad']);
  });
});
