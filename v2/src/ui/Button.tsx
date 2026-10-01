'use client';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { buttonVariants } from './button-variants';
import { cn } from './cn';

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

export { buttonVariants };
