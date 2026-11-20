import { cn } from './cn';

/**
 * The official Direct logo (public brand asset): slate wordmark + orange plane for light grounds,
 * the white-wordmark variant for slate and dark grounds. Never recoloured, never stretched;
 * clear space around it is at least the height of the D (the padding here).
 */
// The themes whose grounds are dark (tokens.css `color-scheme: dark`): Dark, Turquoise, and System on a dark device.
// Before Landing 34 only Dark was named, so the slate wordmark sat on Turquoise's and System-dark's dark grounds.
const HIDE_ON_DARK =
  '[[data-theme=dark]_&]:hidden [[data-theme=turquoise]_&]:hidden [@media(prefers-color-scheme:dark)]:[[data-theme=system]_&]:hidden';
const SHOW_ON_DARK =
  '[[data-theme=dark]_&]:block [[data-theme=turquoise]_&]:block [@media(prefers-color-scheme:dark)]:[[data-theme=system]_&]:block';

export function BrandLogo({
  variant = 'auto',
  height = 28,
  className,
  label = 'Direct',
}: {
  /** `auto` follows the theme: white on a dark ground (Dark, Turquoise, System on a dark device), slate elsewhere.
   *  `on-dark` for the slate drawer. */
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
        className={cn('block', HIDE_ON_DARK)}
      />
      <img
        src="/brand/direct-logo-on-dark.svg"
        alt=""
        aria-hidden="true"
        width={width}
        height={height}
        className={cn('hidden', SHOW_ON_DARK)}
      />
    </span>
  );
}

/**
 * The workspace's name as it is shown (Landing 34, items 36–38): the Direct wordmark — the artwork, untouched — and
 * beside it the word "Corporate" as TEXT in the display face, in the colour of the ground it sits on (it inherits).
 * The word is sized from the logo's height (never under 12 px) and may shorten with "…" in a tight place; the wordmark
 * never shrinks. In Arabic the wordmark keeps its Latin letters and the word is «للشركات». One element for the
 * drawer, the phone's top bar and the door, so the three always read the same.
 */
export function BrandLockup({
  word,
  variant = 'auto',
  height = 28,
  label = 'Direct',
  className,
}: {
  /** The word beside the wordmark, in the language on screen (`app.corporate`). */
  word: string;
  variant?: 'auto' | 'light' | 'on-dark';
  height?: number;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn('inline-flex min-w-0 items-center', className)}
      style={{ columnGap: Math.round(height * 0.28) }}
      data-brand-lockup
    >
      <BrandLogo variant={variant} height={height} label={label} className="shrink-0" />
      <span
        className="min-w-0 truncate font-display font-semibold leading-none"
        style={{ fontSize: Math.max(12, Math.round(height * 0.62)) }}
        data-brand-word
      >
        {word}
      </span>
    </span>
  );
}
