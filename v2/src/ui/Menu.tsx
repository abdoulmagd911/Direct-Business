'use client';
import * as RM from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

/** A dropdown menu (the ⋯ menu, the Create menu, the profile menu). Radix handles focus and Escape. */
export const Menu = RM.Root;
export const MenuTrigger = RM.Trigger;

export function MenuContent({ children, className, align = 'end', ...rest }: RM.DropdownMenuContentProps) {
  return (
    <RM.Portal>
      <RM.Content
        align={align}
        sideOffset={6}
        className={cn(
          'z-50 min-w-56 rounded-lg border border-border bg-raised p-1.5 text-text shadow-2',
          className,
        )}
        {...rest}
      >
        {children}
      </RM.Content>
    </RM.Portal>
  );
}

export const menuItemClass =
  'flex h-9 cursor-default select-none items-center gap-2.5 rounded-md px-2.5 text-base outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent-soft [&_svg]:size-4 [&_svg]:text-muted';

/** With `asChild` the child (a Link) is the item and carries its own icon: Radix slots one element only. */
export function MenuItem({
  children,
  className,
  icon,
  asChild,
  ...rest
}: RM.DropdownMenuItemProps & { icon?: ReactNode }) {
  return (
    <RM.Item className={cn(menuItemClass, className)} asChild={asChild} {...rest}>
      {asChild ? (
        children
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </RM.Item>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <RM.Label className="px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-[.07em] text-muted">
      {children}
    </RM.Label>
  );
}

export function MenuSeparator() {
  return <RM.Separator className="my-1.5 h-px bg-border" />;
}

export function MenuRadioGroup(props: RM.DropdownMenuRadioGroupProps) {
  return <RM.RadioGroup {...props} />;
}

export function MenuRadioItem({ children, className, ...rest }: RM.DropdownMenuRadioItemProps) {
  return (
    <RM.RadioItem className={cn(menuItemClass, 'relative pe-8', className)} {...rest}>
      {children}
      <RM.ItemIndicator className="absolute end-2.5">
        <Check className="size-4 !text-text" aria-hidden="true" />
      </RM.ItemIndicator>
    </RM.RadioItem>
  );
}
