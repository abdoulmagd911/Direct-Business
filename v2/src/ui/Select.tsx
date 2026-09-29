'use client';
import * as RS from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from './cn';
import { inputClass } from './Input';

export type SelectOption = { value: string; label: string; disabled?: boolean };

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  id,
  className,
  disabled,
  'aria-label': ariaLabel,
}: {
  value?: string;
  onValueChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  return (
    <RS.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RS.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          inputClass,
          'inline-flex h-[var(--control-h)] items-center justify-between gap-2 text-start data-[placeholder]:text-muted',
          className,
        )}
      >
        <RS.Value placeholder={placeholder} />
        <RS.Icon>
          <ChevronDown className="size-4 text-muted" aria-hidden="true" />
        </RS.Icon>
      </RS.Trigger>
      <RS.Portal>
        <RS.Content
          position="popper"
          sideOffset={4}
          className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border bg-raised p-1 text-text shadow-2"
        >
          <RS.Viewport>
            {options.map((o) => (
              <RS.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="relative flex h-9 cursor-default select-none items-center rounded-md pe-8 ps-3 text-base outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent-soft data-[state=checked]:font-medium"
              >
                <RS.ItemText>{o.label}</RS.ItemText>
                <RS.ItemIndicator className="absolute end-2">
                  <Check className="size-4" aria-hidden="true" />
                </RS.ItemIndicator>
              </RS.Item>
            ))}
          </RS.Viewport>
        </RS.Content>
      </RS.Portal>
    </RS.Root>
  );
}
