/**
 * QA-521 (the Architect on #179): someone in no team who may not give tasks to others can neither own a task nor pick
 * another owner. Quick add says "You're not in a team yet. Ask an admin to add you to one." with no picker and no save;
 * the admin account (no team, with `tasks.assign`) keeps its owner picker (V277). Every value is made up (rule 7).
 * Sabotage: tests/sabotage/tasks.mjs "no-team-without-assign-gets-a-dead-form".
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { noTeamToWorkIn } from '../../../src/modules/tasks/rules';
import { ME } from './fixtures';

const me = vi.hoisted(() => ({ current: { team: null as string | null, capabilities: [] as string[] } }));
vi.mock('@/core/auth/me-context', () => ({
  useMe: () => ({ person: { id: ME, team_id: me.current.team }, capabilities: me.current.capabilities, levels: {} }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));

const { QuickAddForm } = await import('../../../src/modules/tasks/screens/QuickAdd');

const TEAM = '33333333-3333-4333-8333-333333333333';
const html = (team: string | null, capabilities: string[]) => {
  me.current = { team, capabilities };
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <QuickAddForm org={null} partners={[]} projects={[]} onClose={() => {}} />
    </NextIntlClientProvider>,
  );
};

describe('someone in no team who may not assign is told why (QA-521)', () => {
  it('is in no team to work in only with no team and no tasks.assign', () => {
    expect(noTeamToWorkIn(null, false)).toBe(true);
    expect(noTeamToWorkIn(null, true), 'the admin account picks an owner instead').toBe(false);
    expect(noTeamToWorkIn(TEAM, false)).toBe(false);
  });

  it('Quick add says so in one line, with no save', () => {
    const out = html(null, []);
    expect(out, 'Quick add says to ask for a team').toContain('not in a team yet. Ask an admin to add you to one.');
    expect(out).not.toContain('Add task');
  });

  it('someone in a team, and the admin account, still get the form', () => {
    expect(html(TEAM, [])).toContain('Add task');
    expect(html(null, ['tasks.assign'])).toContain('Pick an owner');
  });
});
