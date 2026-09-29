import { Avatar, type AvatarPerson } from './Avatar';
import { PersonChip } from './PersonChip';
import { cn } from './cn';

/** Owner first (marked), helpers after; three avatars then "+n". Each is a link to the person. */
export function AvatarStack({
  owner,
  helpers = [],
  hrefOf,
  max = 3,
  size = 'sm',
  className,
}: {
  owner: AvatarPerson;
  helpers?: AvatarPerson[];
  hrefOf: (p: AvatarPerson) => string;
  max?: number;
  size?: 'xs' | 'sm';
  className?: string;
}) {
  const all = [owner, ...helpers];
  const shown = all.slice(0, max);
  const rest = all.length - shown.length;
  return (
    <span className={cn('inline-flex items-center [&>*+*]:-ms-1.5', className)} data-avatar-stack>
      {shown.map((p, i) => (
        <PersonChip
          key={`${p.displayName}-${i}`}
          person={p}
          href={hrefOf(p)}
          size={size}
          nameless
          className={cn('rounded-full', i === 0 && 'outline outline-2 -outline-offset-2 outline-accent')}
        />
      ))}
      {rest > 0 ? (
        <span
          className={cn(
            'inline-grid place-items-center rounded-full bg-surface font-data text-muted ring-2 ring-raised shadow-[inset_0_0_0_1px_var(--border)]',
            size === 'xs' ? 'size-6 text-[10px]' : 'size-7 text-[11px]',
          )}
          aria-label={`+${rest}`}
        >
          +{rest}
        </span>
      ) : null}
    </span>
  );
}

export { Avatar };
