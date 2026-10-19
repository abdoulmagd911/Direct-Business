'use client';
import * as RC from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { cn } from './cn';

/** A checkbox; the tick is an icon (non-text) on the accent fill, so it passes the 3:1 rule in Direct. */
export function Checkbox({
  checked,
  onCheckedChange,
  label,
  id,
  className,
  disabled,
}: {
  checked: boolean | 'indeterminate';
  onCheckedChange: (v: boolean) => void;
  label: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <RC.Root
      id={id}
      checked={checked}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      disabled={disabled}
      aria-label={label}
      className={cn(
        // a 44 px button on a phone with the 20 px box drawn inside it (V630); the box is the ::before
        'relative inline-grid size-11 shrink-0 place-items-center disabled:opacity-50 sm:size-5 before:absolute before:inset-x-0 before:mx-auto before:top-1/2 before:size-5 before:-translate-y-1/2 before:rounded-[5px] before:border-[1.5px] before:border-border-strong before:bg-raised before:transition-colors before:duration-[var(--dur)] before:content-[""] data-[state=checked]:before:border-accent data-[state=checked]:before:bg-accent data-[state=indeterminate]:before:border-accent data-[state=indeterminate]:before:bg-accent',
        className,
      )}
    >
      <RC.Indicator className="relative text-on-accent">
        {checked === 'indeterminate' ? (
          <Minus className="size-3.5" strokeWidth={3} aria-hidden="true" />
        ) : (
          <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
        )}
      </RC.Indicator>
    </RC.Root>
  );
}
