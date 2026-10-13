/**
 * Notes and mentions (V143, V150): a note is seen as its record is; only people who can see the record may be
 * mentioned; a person without access to the record gets nothing — not the timeline, not the note's history, not a
 * notice — through the Data API with their own session. Notes have no screen or address of their own yet, and
 * private notes (V433, My day) are P3-13: those lines are NOT BUILT.
 */
import { test } from '@playwright/test';
import { apiAs, fx, inWords, notBuilt, said, sql, user, verdict } from './lib';

const AREA = 'notes';

test('a note on a Client-only organisation reaches only those who may see it', async () => {
  const f = fx();
  const alpha = f.orgs.alpha.id;
  const note = f.notes.alpha;

  const member = await (await apiAs('member'))('notifications', { p_tab: 'mentions' });
  verdict(
    {
      area: AREA,
      user: 'member',
      screen: '(api) notifications mentions',
      check: 'the mentioned person is told',
      detail: JSON.stringify(member.data ?? '').includes(alpha) ? 'mention present' : said(member),
    },
    member.ok && JSON.stringify(member.data ?? '').includes(alpha),
  );
  const viewer = await (await apiAs('viewer'))('notes', { p_entity: 'partner', p_id: alpha });
  verdict(
    {
      area: AREA,
      user: 'viewer',
      screen: '(api) notes [alpha]',
      check: 'Clients · View reads the timeline',
      detail: JSON.stringify(viewer.data ?? '').includes(note) ? 'note listed' : said(viewer),
    },
    viewer.ok && JSON.stringify(viewer.data ?? '').includes(note),
  );

  for (const key of ['noclients', 'noclientscap', 'nolevels']) {
    const api = await apiAs(key);
    const base = { area: AREA, user: key };
    const notes = await api('notes', { p_entity: 'partner', p_id: alpha });
    verdict(
      { ...base, screen: '(api) notes [alpha]', check: 'the timeline is refused, in words', detail: said(notes) },
      !notes.ok && inWords(notes),
    );
    const history = await api('record_history', { p_entity: 'note', p_id: note });
    verdict(
      {
        ...base,
        screen: '(api) record_history note',
        check: "the note's history is refused, in words",
        detail: said(history),
      },
      !history.ok && inWords(history),
    );
    const see = await api('can_see', { p_entity: 'note', p_id: note });
    verdict(
      { ...base, screen: '(api) can_see note', check: 'can_see says no', detail: said(see) },
      see.ok && see.data === false,
    );
    const mentionRows = await sql<{ id: string }>(`select id::text from core.mention where note_id = $1`, [note]);
    for (const m of mentionRows) {
      const hm = await api('record_history', { p_entity: 'mention', p_id: m.id });
      verdict(
        {
          ...base,
          screen: '(api) record_history mention',
          check: "a mention's history is refused, in words",
          detail: said(hm),
        },
        !hm.ok && inWords(hm),
      );
    }
    const bell = await api('notifications', { p_tab: 'all' });
    verdict(
      {
        ...base,
        screen: '(api) notifications',
        check: 'no notice about the note',
        detail: JSON.stringify(bell.data ?? '').includes(alpha) ? 'ALPHA IN THE BELL' : said(bell).slice(0, 80),
      },
      !JSON.stringify(bell.data ?? '').includes(alpha),
    );
    const edit = await api('note_edit', { p_id: note, p_values: { body: 'changed' }, p_version: 1 });
    verdict(
      { ...base, screen: '(api) note_edit', check: 'cannot edit it — refused in words', detail: said(edit) },
      !edit.ok && inWords(edit),
    );
    const remove = await api('notes_remove', { p_ids: [note], p_reason: 'QA sweep' });
    verdict(
      { ...base, screen: '(api) notes_remove', check: 'cannot remove it — refused in words', detail: said(remove) },
      !remove.ok && inWords(remove),
    );
    const search = await api('search', { p_q: `Test note on Alpha ${f.tag}` });
    verdict(
      {
        ...base,
        screen: '(api) search',
        check: "search does not surface the note's organisation",
        detail: said(search),
      },
      !JSON.stringify(search.data ?? '').includes(alpha),
    );
  }

  const admin = await apiAs('admin');
  for (const key of ['noclients', 'nolevels']) {
    const before = await sql<{ n: string }>(
      `select count(*)::text as n from notify.notification where person_id = $1`,
      [user(key).id],
    );
    const r = await admin('note_add', {
      p_entity: 'partner',
      p_id: alpha,
      p_kind: 'comment',
      p_body: `Test note mentioning ${key} ${f.tag}`,
      p_mentions: [user(key).id],
    });
    const after = await sql<{ n: string }>(`select count(*)::text as n from notify.notification where person_id = $1`, [
      user(key).id,
    ]);
    verdict(
      {
        area: AREA,
        user: 'admin',
        screen: '(api) note_add mentions',
        check: `someone who cannot see the record (${key}) cannot be mentioned — refused in words, nobody told`,
        detail: `${said(r)} · notices ${before[0]?.n} → ${after[0]?.n}`,
      },
      !r.ok && inWords(r) && before[0]?.n === after[0]?.n,
    );
    const req = (r.data as { request_id?: string } | null)?.request_id;
    if (r.ok && req) await admin('undo', { p_request: req });
  }

  // a two-sided organisation's notes belong to the whole record: the Supplier & partner side reads them (V150)
  const beta = await (await apiAs('noclients'))('notes', { p_entity: 'partner', p_id: f.orgs.beta.id });
  verdict(
    {
      area: AREA,
      user: 'noclients',
      screen: '(api) notes [beta]',
      check: "a two-sided organisation's timeline is readable from the Supplier & partner side (V150)",
      detail: said(beta).slice(0, 120),
    },
    beta.ok,
  );

  notBuilt({
    area: AREA,
    screen: '(UI)',
    check: 'the timeline and notes on a record page, by direct URL',
    detail: 'the organisation page is P3-9; notes have no address of their own (V150)',
  });
  notBuilt({
    area: AREA,
    screen: '(UI)',
    check: 'private notes and mentions (My day notes: private · team · workspace — V433)',
    detail: 'P3-13 / P3-14',
  });
});
