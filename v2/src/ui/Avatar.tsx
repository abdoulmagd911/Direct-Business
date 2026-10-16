import { cn } from './cn';
import { BADGE_ICONS } from './badges';

/** No zodiac kind (V493): a stored one from before draws nothing. */
export type BadgeKind = 'none' | 'icon';

export type AvatarPerson = {
  displayName: string;
  fullName?: string;
  avatarUrl?: string | null;
  badge?: { kind: BadgeKind; value: string | null };
};

const sizes = {
  xs: 'size-6 text-[9.5px]',
  sm: 'size-7 text-[11px]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-base',
  xl: 'size-14 text-xl',
  '2xl': 'size-24 text-3xl',
};
/** Initials sit on a soft tint with no ring of their own: one look for everyone (V636, owner 14 Oct). */
const tint = 'bg-accent-soft';

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  // a word that starts with a digit or a mark ("13Oct", "8Oct", "-") is not a name: initials come from letters
  const named = words.filter((w) => /^\p{L}/u.test(w));
  const use = named.length ? named : words;
  const first = use[0]?.[0] ?? '';
  const last = use.length > 1 ? (use[use.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

const rings = {
  raised: 'ring-2 ring-raised',
  nav: 'ring-2 ring-[color-mix(in_srgb,currentColor_35%,transparent)]',
  none: '',
};

/**
 * Photo or initials, with the person's optional badge. `ring` names the surface
 * the avatar sits on, so it stays visible when its colour equals that surface (c3 is the Direct slate).
 */
export function Avatar({
  person,
  size = 'md',
  className,
  ring = 'raised',
}: {
  person: AvatarPerson;
  size?: keyof typeof sizes;
  className?: string;
  ring?: keyof typeof rings;
}) {
  const title = person.fullName ?? person.displayName;
  const badge = person.badge && person.badge.kind !== 'none' && person.badge.value ? person.badge : null;
  const Icon = badge?.kind === 'icon' ? BADGE_ICONS[badge.value!] : undefined;
  return (
    <span className={cn('relative inline-flex shrink-0', className)} data-avatar>
      {person.avatarUrl ? (
        <img src={person.avatarUrl} alt={title} className={cn('rounded-full object-cover', sizes[size], rings[ring])} />
      ) : (
        <span
          role="img"
          aria-label={title}
          className={cn(
            'inline-grid place-items-center rounded-full font-semibold leading-none tracking-[.02em] text-text',
            tint,
            sizes[size],
            rings[ring],
          )}
        >
          {initialsOf(title)}
        </span>
      )}
      {Icon ? (
        <span
          aria-hidden="true"
          className={cn(
            'absolute -bottom-0.5 inline-grid place-items-center rounded-full bg-raised text-c3 shadow-[0_0_0_1.5px_var(--raised),0_0_0_2.5px_var(--border)]',
            size === 'xs' || size === 'sm'
              ? '-end-1 size-3.5 text-[9px] [&_svg]:size-2.5'
              : size === '2xl'
                ? '-end-0.5 size-8 text-base [&_svg]:size-4'
                : '-end-1 size-4 text-[10px] [&_svg]:size-2.5',
          )}
        >
          <Icon strokeWidth={2.5} />
        </span>
      ) : null}
    </span>
  );
}
