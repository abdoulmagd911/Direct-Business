import { cn } from './cn';
import { initialsOf } from './Avatar';

const sizes = { sm: 'size-7 text-[11px]', md: 'size-9 text-xs', lg: 'size-12 text-sm', xl: 'size-16 text-lg' };

/**
 * An organisation's logo, or a monogram of its initials when it has none (§3.4: `partner.logo_fallback`). The logo
 * file arrives with P3-9b's upload; until then every organisation shows its monogram, in the surface colour so the
 * accent never carries text (V7).
 */
export function PartnerLogo({
  name,
  logoUrl,
  size = 'md',
  className,
}: {
  name: string;
  logoUrl?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface font-semibold text-text',
        sizes[size],
        className,
      )}
      data-partner-logo
      aria-hidden="true"
    >
      {logoUrl ? <img src={logoUrl} alt="" className="size-full object-contain" /> : initialsOf(name)}
    </span>
  );
}
