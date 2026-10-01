// The Past work grid on Tasks (P5-2c mounted by builder D; V276): what the screen hands builder C's grid. Pure, so
// each rule is unit-tested and sabotaged (tests/unit/tasks, tests/sabotage/tasks.mjs). The database decides every
// row when it saves (api.backfill_tasks, V196); these only prepare the lookups and read its answers.
import type { Choice, OrgMatch, PersonMatch } from '@/ui/grid/rows';
import type { NamePick, TaskStatus } from './types';

/**
 * A name as the screen compares it: the same letters whatever the case or the spacing — nothing else. Folding Arabic
 * (short vowels, the tatweel, letter forms) is the database's (norm.*, A10); until it answers organisation names itself
 * (asked of builder A, like api.people_match), a name that differs in more than case or spacing is Unknown, never a
 * guess.
 */
export function plainName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Each pasted organisation name against the clients the person may see, by English or Arabic name: exactly one is a
 * match, none is unknown, two or more is ambiguous — never a guess (V504's grid refuses both).
 */
export function matchOrganisations(names: readonly string[], partners: readonly NamePick[]): Map<string, OrgMatch> {
  const index = new Map<string, Set<string>>();
  for (const p of partners)
    for (const n of [p.name_en, p.name_ar]) {
      if (!n) continue;
      const k = plainName(n);
      if (!k) continue;
      (index.get(k) ?? index.set(k, new Set()).get(k)!).add(p.id);
    }
  const out = new Map<string, OrgMatch>();
  for (const name of names) {
    const hits = index.get(plainName(name));
    out.set(
      name,
      !hits || hits.size === 0
        ? { kind: 'none' }
        : hits.size === 1
          ? { kind: 'one', id: [...hits][0]! }
          : { kind: 'many' },
    );
  }
  return out;
}

/** api.people_match's answer (`{ name: { kind, id? } }`) as the grid reads it; a name it left out stays unanswered. */
export function readPeopleMatch(answer: unknown): Map<string, PersonMatch> {
  const out = new Map<string, PersonMatch>();
  if (!answer || typeof answer !== 'object') return out;
  for (const [name, v] of Object.entries(answer as Record<string, { kind?: string; id?: string }>)) {
    if (v?.kind === 'one' && typeof v.id === 'string') out.set(name, { kind: 'one', id: v.id });
    else if (v?.kind === 'none') out.set(name, { kind: 'none' });
    else if (v?.kind === 'many') out.set(name, { kind: 'many' });
  }
  return out;
}

/** api.backfill_keys_held's answer (the keys already saved) as a set; anything else holds nothing. */
export function readHeldKeys(answer: unknown): Set<string> {
  return new Set(Array.isArray(answer) ? answer.filter((k): k is string => typeof k === 'string') : []);
}

/** The statuses a pasted row may name (V401's four meanings, by their live names), in the statuses' own order. */
export function statusChoices(statuses: readonly TaskStatus[]): Choice[] {
  return [...statuses]
    .filter((s) => s.active)
    .sort((a, b) => a.sort - b.sort)
    .map((s) => ({ key: s.key, en: s.name_en, ar: s.name_ar }));
}

/** The status a row with none takes: Done (a past task was done — V196's own default). */
export function defaultPastStatus(statuses: readonly TaskStatus[]): string | null {
  return statuses.find((s) => s.active && s.meaning === 'done')?.key ?? null;
}
