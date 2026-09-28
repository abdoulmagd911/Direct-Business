'use client';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

/**
 * Buttons. A filled button uses --primary/--on-primary (in Direct: #C94C14 with a white label, AA);
 * --accent is never a button fill (check-accent-fill-only). Heights from the density tokens.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border font-medium leading-none transition-colors duration-[var(--dur)] select-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'border-transparent bg-primary text-on-primary hover:bg-primary-hover',
        secondary: 'border-border-strong bg-raised text-text hover:bg-surface',
        ghost: 'border-transparent bg-transparent text-text hover:bg-[color-mix(in_srgb,var(--text)_8%,transparent)]',
        danger:
          'border-[color-mix(in_srgb,var(--danger)_45%,transparent)] bg-transparent text-danger hover:bg-danger-soft',
        link: 'h-auto border-transparent bg-transparent p-0 text-link underline-offset-2 hover:underline',
      },
      size: {
        md: 'h-[var(--control-h)] px-4 text-base',
        sm: 'h-[var(--control-h-sm)] px-3 text-sm',
        xs: 'h-[var(--control-h-xs)] px-2.5 text-sm',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { loading?: boolean; icon?: ReactNode };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading, icon, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
});
