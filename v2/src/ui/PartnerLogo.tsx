import { cn } from './cn';
import { initialsOf } from './Avatar';

const sizes = {
  sm: 'size-7 text-[12px]',
  md: 'size-9 text-xs',
  lg: 'size-12 text-sm',
  xl: 'size-16 rounded-lg text-lg',
};

/**
 * An organisation's logo, or a monogram of its initials when it has none (§3.4: `partner.logo_fallback`). The logo
 * file arrives with P3-9b's upload; until then every organisation shows its monogram on the peach tile (12 px
 * corners, 16 px on the largest), in the peach ink — the vivid accent itself never carries text (V7).
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
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md font-semibold',
        // the organisation tile of the look: initials in the peach ink on the peach ground; a logo keeps a plain card
        logoUrl ? 'border border-border bg-raised' : 'bg-accent-soft text-accent-ink',
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
