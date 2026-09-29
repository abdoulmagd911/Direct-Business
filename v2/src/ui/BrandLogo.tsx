import { cn } from './cn';

/**
 * The official Direct logo (public brand asset): slate wordmark + orange plane for light grounds,
 * the white-wordmark variant for slate and dark grounds. Never recoloured, never stretched;
 * clear space around it is at least the height of the D (the padding here).
 */
export function BrandLogo({
  variant = 'auto',
  height = 28,
  className,
  label = 'Direct',
}: {
  /** `auto` follows the theme: white on Dark, slate elsewhere. `on-dark` for the slate drawer. */
  variant?: 'auto' | 'light' | 'on-dark';
  height?: number;
  className?: string;
  label?: string;
}) {
  const width = Math.round((height * 74) / 32);
  const style = { height, width, padding: 0 };
  if (variant === 'light') {
    return (
      <img
        src="/brand/direct-logo.svg"
        alt={label}
        width={width}
        height={height}
        style={style}
        className={cn('block', className)}
      />
    );
  }
  if (variant === 'on-dark') {
    return (
      <img
        src="/brand/direct-logo-on-dark.svg"
        alt={label}
        width={width}
        height={height}
        style={style}
        className={cn('block', className)}
      />
    );
  }
  return (
    <span className={cn('inline-block', className)} style={style} data-brand-logo>
      <img
        src="/brand/direct-logo.svg"
        alt={label}
        width={width}
        height={height}
        className="block [[data-theme=dark]_&]:hidden"
      />
      <img
        src="/brand/direct-logo-on-dark.svg"
        alt=""
        aria-hidden="true"
        width={width}
        height={height}
        className="hidden [[data-theme=dark]_&]:block"
      />
    </span>
  );
}
