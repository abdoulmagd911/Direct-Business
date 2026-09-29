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
        'inline-grid size-5 shrink-0 place-items-center rounded-[5px] border-[1.5px] border-border-strong bg-raised transition-colors duration-[var(--dur)] data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent disabled:opacity-50',
        className,
      )}
    >
      <RC.Indicator className="text-on-accent">
        {checked === 'indeterminate' ? (
          <Minus className="size-3.5" strokeWidth={3} aria-hidden="true" />
        ) : (
          <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
        )}
      </RC.Indicator>
    </RC.Root>
  );
}
