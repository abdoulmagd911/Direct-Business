'use client';
import * as RSw from '@radix-ui/react-switch';
import { cn } from './cn';

export function Switch({
  checked,
  onCheckedChange,
  label,
  id,
  disabled,
  className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <RSw.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className={cn(
        // a 44 px button on a phone with the 24 px track drawn inside it (V630); the track is the ::before
        'relative inline-flex h-11 w-10 shrink-0 items-center disabled:opacity-50 sm:h-6 before:absolute before:inset-x-0 before:top-1/2 before:h-6 before:-translate-y-1/2 before:rounded-pill before:bg-border-strong before:transition-colors before:duration-[var(--dur)] before:content-[""] data-[state=checked]:before:bg-primary',
        className,
      )}
    >
      <RSw.Thumb className="relative block size-[18px] rounded-pill bg-raised shadow-1 transition-transform duration-[var(--dur)] translate-x-[3px] data-[state=checked]:translate-x-[19px] rtl:-translate-x-[3px] rtl:data-[state=checked]:-translate-x-[19px]" />
    </RSw.Root>
  );
}
