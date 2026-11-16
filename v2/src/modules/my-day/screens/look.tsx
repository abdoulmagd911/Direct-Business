import type { ReactNode } from 'react';
import { cn } from '@/ui/cn';

/**
 * The look of My day's own pieces (V21, Landing 31): a white card on the page colour with 16 px corners and the soft
 * shadow; a card's head with its peach icon circle; the pill a filter is; the empty state when it sits inside a card
 * that is already drawn. Every colour is a token, so the five themes follow.
 */
export const card = 'min-w-0 rounded-lg border border-border bg-raised px-4 shadow-1 sm:px-5';

/** A filter pill: 44 px on a phone, 36 px on a wide screen; the chosen one is the soft accent fill. */
export const pill = (on: boolean) =>
  cn(
    'inline-flex min-h-11 items-center whitespace-nowrap rounded-pill border px-3.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-focus sm:min-h-9',
    on
      ? 'border-accent bg-accent-soft text-strong'
      : 'border-border bg-raised text-muted hover:bg-surface hover:text-text',
  );

/** A text link inside a card that is a control ("Show all", "More"): a full 44 px tap on a phone. */
export const cardLink =
  'inline-flex min-h-11 items-center text-sm font-medium text-link hover:underline focus-visible:outline-2 focus-visible:outline-focus sm:min-h-8';

/** The kit's empty state drawn inside a card: the card is already there, so it brings no second frame. */
export const emptyInCard = 'rounded-none border-0 bg-transparent px-2 py-8 shadow-none max-sm:py-6';

/** The peach circle a card's icon sits on: 40 px, 32 px on a phone. */
export function IconCircle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-grid size-[var(--icon-circle)] shrink-0 place-items-center rounded-pill bg-accent-soft text-accent-ink max-sm:size-8 [&_svg]:size-5 max-sm:[&_svg]:size-4',
        className,
      )}
      data-icon-circle
    >
      {children}
    </span>
  );
}

/**
 * A card's head: the icon circle, the title (the one `h2` of the card — only the title's words are in it), and
 * whatever sits at the end edge (a count, a link). It wraps rather than squeezes when the end part is long.
 */
export function CardHead({
  icon,
  title,
  children,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border py-3', className)}>
      {icon ? <IconCircle>{icon}</IconCircle> : null}
      <h2 className="min-w-0 flex-1 break-words text-lg font-medium leading-6 text-strong">{title}</h2>
      {children}
    </div>
  );
}

/** The small heading of a group inside a card ("Do now 2"): 13 px, muted, never under 12 px. */
export const groupHead = 'pt-3 text-sm font-semibold text-muted';
