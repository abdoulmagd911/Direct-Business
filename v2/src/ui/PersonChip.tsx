import Link from 'next/link';
import { Avatar, type AvatarPerson } from './Avatar';
import { cn } from './cn';

/**
 * Every person is shown with the same chip (avatar + display name), a link to their record, so a
 * rename or a new photo updates everywhere at once (V9).
 */
export function PersonChip({
  person,
  href,
  size = 'sm',
  className,
  nameless = false,
}: {
  person: AvatarPerson;
  href: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  /** Avatar only (stacks); the name stays in the accessible label. */
  nameless?: boolean;
}) {
  return (
    <Link
      href={href}
      data-entity="person"
      aria-label={nameless ? (person.fullName ?? person.displayName) : undefined}
      className={cn(
        'inline-flex items-center gap-2 whitespace-nowrap font-medium text-text hover:[&_.name]:underline',
        className,
      )}
    >
      <Avatar person={person} size={size} />
      {nameless ? null : <span className="name">{person.displayName}</span>}
    </Link>
  );
}
