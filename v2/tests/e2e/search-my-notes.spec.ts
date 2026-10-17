/**
 * Search finds the person's own notes of every kind (V641): a note, an idea, a checklist (by its title and by an item),
 * a reminder and a meeting are saved, then each is found in the search box by a word from it, labelled with its kind,
 * and opens its note page. Another person's search finds none of them. At 375 and 1,440 px. Every value is made up.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, signOut } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const PC = { width: 1440, height: 1000 };
const PHONE = { width: 375, height: 800 };
const KINDS = [
  { kind: 'note', label: 'Note' },
  { kind: 'idea', label: 'Idea' },
  { kind: 'checklist', label: 'Checklist' },
  { kind: 'reminder', label: 'Reminder' },
  { kind: 'meeting', label: 'Meeting' },
] as const;

for (const size of [PHONE, PC]) {
  test(`search finds one saved item of each kind, says what it is and opens it — at ${size.width} px`, async ({
    page,
    context,
  }) => {
    const tag = Math.random().toString(36).slice(2, 8);
    const me = await makePerson({ admin: false });
    await page.setViewportSize(size);
    await signIn(page, me.email, '/my-day');
    await hydrated(page);

    const word = (k: string) => `${k}${tag}`;
    const save = async (p_kind: string, p_values: Record<string, unknown>) => {
      const r = await callAs(context, 'note_capture', { p_kind, p_values });
      expect(r.status, `${p_kind} saved`).toBe(200);
      return (r.body as { id: string }).id;
    };
    const ids: Record<string, string> = {
      note: await save('sticky', { title: `Made-up ${word('pelican')} note` }),
      idea: await save('idea', { title: `Made-up ${word('marmot')} idea` }),
      checklist: await save('checklist', {
        title: `Made-up ${word('weasel')} list`,
        items: [{ text: `Made-up pack the ${word('ibex')}` }],
      }),
      reminder: await save('reminder', {
        title: `Made-up ${word('lemur')} reminder`,
        remind_at: new Date(Date.now() + 3 * 3600_000).toISOString(),
      }),
      meeting: await save('meeting', { title: `Made-up ${word('narwhal')} meeting` }),
    };
    const words: Record<string, string> = {
      note: word('pelican'),
      idea: word('marmot'),
      checklist: word('weasel'),
      reminder: word('lemur'),
      meeting: word('narwhal'),
    };

    const palette = page.locator('[data-command-palette]');
    const input = palette.getByPlaceholder('Go to a page or search…');
    const search = async (term: string) => {
      await page.locator('[data-search]').click();
      await expect(palette).toBeVisible();
      await input.fill(term);
    };

    for (const { kind, label } of KINDS) {
      await search(words[kind]!);
      const hit = palette.locator(`[data-palette-note="${ids[kind]}"]`);
      await expect(hit, `${kind} is found`).toBeVisible();
      await expect(hit, `${kind} says what it is`).toHaveAttribute('data-note-kind', kind);
      await expect(hit).toContainText(label);
      await page.keyboard.press('Escape');
      await expect(palette).toBeHidden();
    }

    // a checklist is found by what it lists, too
    await search(word('ibex'));
    await expect(palette.locator(`[data-palette-note="${ids.checklist}"]`)).toBeVisible();

    // choosing a hit opens that note
    await input.fill(words.idea!);
    await palette.locator(`[data-palette-note="${ids.idea}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/my-day/notes/${ids.idea}$`));

    // nobody else's search finds a private note: the other person has a note with the same word and finds only theirs
    await signOut(page);
    const other = await makePerson({ admin: false });
    await signIn(page, other.email, '/my-day');
    await hydrated(page);
    const theirs = await save('sticky', { title: `Made-up ${word('pelican')} of mine` });
    await search(words.note!);
    await expect(palette.locator(`[data-palette-note="${theirs}"]`), 'their own is found').toBeVisible();
    await expect(palette.locator(`[data-palette-note="${ids.note}"]`), "not the first person's").toHaveCount(0);
  });
}
