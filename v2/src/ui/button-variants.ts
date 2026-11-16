import { cva } from 'class-variance-authority';

/**
 * Buttons (V21): pills, 40 px (small 32, large 50), 600 14/20. The one filled button is the deep orange
 * (--primary/--on-primary, white on it is 4.8:1 in every theme); --accent is never a button fill
 * (check-accent-fill-only). Hover darkens one step, a press two steps and shrinks to 98% for 80 ms (`press`);
 * a disabled button is the pressed fill with a muted label and no shadow. `danger` is the destructive outline,
 * `danger-fill` the destructive filled button.
 */
export const buttonVariants = cva(
  'press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill border font-semibold leading-5 select-none disabled:cursor-not-allowed disabled:border-transparent disabled:bg-pressed disabled:text-muted disabled:shadow-none focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'border-transparent bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-pressed shadow-button active:shadow-button-pressed',
        secondary: 'border-border-strong bg-raised text-strong hover:bg-surface active:bg-pressed',
        ghost: 'border-transparent bg-transparent text-strong hover:bg-surface active:bg-pressed',
        danger: 'border-border-strong bg-raised text-danger hover:bg-surface active:bg-pressed',
        'danger-fill': 'border-transparent bg-danger text-raised shadow-button hover:opacity-90 active:opacity-80',
        link: 'h-auto rounded-sm border-transparent bg-transparent p-0 font-medium text-link underline underline-offset-[3px] decoration-[color-mix(in_srgb,var(--link)_35%,transparent)] hover:decoration-current disabled:bg-transparent',
      },
      size: {
        md: 'h-[var(--control-h)] px-[18px] text-base',
        sm: 'h-[var(--control-h-sm)] px-3.5 text-sm',
        xs: 'h-[var(--control-h-xs)] px-3 text-sm',
        lg: 'h-[var(--control-h-lg)] px-6 text-lg',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);
