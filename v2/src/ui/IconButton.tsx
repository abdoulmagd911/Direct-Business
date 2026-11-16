'use client';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

/** An icon-only button, a circle (V21): always has an accessible name (`label`), hit target ≥ 40 px (44 on a phone). */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    icon: ReactNode;
    size?: 'md' | 'sm';
    pressed?: boolean;
  }
>(function IconButton({ label, icon, size = 'md', pressed, className, type = 'button', children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cn(
        'press relative inline-grid shrink-0 place-items-center rounded-pill border border-transparent bg-transparent text-current hover:bg-[color-mix(in_srgb,currentColor_10%,transparent)] active:bg-[color-mix(in_srgb,currentColor_16%,transparent)] aria-pressed:bg-[color-mix(in_srgb,currentColor_16%,transparent)] disabled:cursor-not-allowed disabled:text-muted focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 [&_svg]:size-5',
        size === 'md' ? 'size-[var(--hit)]' : 'size-8 max-sm:size-11 [&_svg]:size-4',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});
