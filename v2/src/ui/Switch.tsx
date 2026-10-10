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
        'relative inline-flex h-6 w-10 shrink-0 before:absolute before:inset-x-0 before:-inset-y-2.5 before:content-[""] items-center rounded-pill bg-border-strong transition-colors duration-[var(--dur)] data-[state=checked]:bg-primary disabled:opacity-50',
        className,
      )}
    >
      <RSw.Thumb className="block size-[18px] rounded-pill bg-raised shadow-1 transition-transform duration-[var(--dur)] translate-x-[3px] data-[state=checked]:translate-x-[19px] rtl:-translate-x-[3px] rtl:data-[state=checked]:-translate-x-[19px]" />
    </RSw.Root>
  );
}
