'use client';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

/** An icon-only button: always has an accessible name (`label`), hit target ≥ 40 px. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    icon: ReactNode;
    size?: 'md' | 'sm';
    pressed?: boolean;
  }
>(function IconButton({ label, icon, size = 'md', pressed, className, type = 'button', ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cn(
        'relative inline-grid shrink-0 place-items-center rounded-md border border-transparent bg-transparent text-current transition-colors duration-[var(--dur)] hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)] aria-pressed:bg-[color-mix(in_srgb,currentColor_18%,transparent)] disabled:opacity-50 [&_svg]:size-[18px]',
        size === 'md' ? 'size-[var(--hit)]' : 'size-8 max-sm:size-11 [&_svg]:size-4',
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
});
