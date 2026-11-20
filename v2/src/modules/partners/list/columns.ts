/**
 * Which columns the list's table draws at the width it has (Landing 31: nothing scrolls sideways between a phone and
 * a wide desk). The width is the table's own place on the page — not the window — because the drawer beside it may be
 * open or folded. The order columns go in is the boards': Type first, then Owner, then Last activity; the
 * organisation, its status and its flags always stay. Under `CARDS_UNDER` there is no room for a table at all and the
 * list is drawn as the phone's rows. The organisation's name takes what is left and wraps inside it (Landing 34: a name is
 * read whole, never cut with "…"). The row's Actions button is always drawn and has its own narrow column.
 */
export const CARDS_UNDER = 600;

/** What each column needs, cell padding included (px). The name is whatever remains. */
const NEED = { select: 44, status: 120, flags: 168, last_activity_on: 136, owner_id: 200, type: 136 } as const;
/** The row's Actions button (Landing 34): a 32 px button in a column of its own, always drawn. */
export const ACTIONS_WIDTH = 40;
const NAME_MIN = 200;
const NAME_MAX = 440;
/** The name cell's own padding and the card's hairlines. */
const NAME_PAD = 26;

export type HideableColumn = 'type' | 'owner_id' | 'last_activity_on';
/** Dropped first → dropped last. */
const DROP_ORDER: HideableColumn[] = ['type', 'owner_id', 'last_activity_on'];

export type ColumnPlan = {
  /** No table: the list is drawn as rows in one card. */
  cards: boolean;
  /** The columns there is no room for. */
  hidden: HideableColumn[];
  /** The most the organisation's name may take (px). */
  nameMax: number;
};

/** `width` 0 means "not measured yet" (the server's render): the full table, as on a wide desk. */
export function columnPlan(width: number, selectable: boolean): ColumnPlan {
  if (width <= 0) return { cards: false, hidden: [], nameMax: NAME_MAX };
  if (width < CARDS_UNDER) return { cards: true, hidden: [...DROP_ORDER], nameMax: NAME_MAX };
  const fixed = (selectable ? NEED.select : 0) + NEED.status + NEED.flags + NAME_PAD + ACTIONS_WIDTH;
  const hidden: HideableColumn[] = [];
  let used = fixed + DROP_ORDER.reduce((sum, c) => sum + NEED[c], 0);
  for (const c of DROP_ORDER) {
    if (width - used >= NAME_MIN) break;
    hidden.push(c);
    used -= NEED[c];
  }
  return { cards: false, hidden, nameMax: Math.max(160, Math.min(NAME_MAX, width - used)) };
}
