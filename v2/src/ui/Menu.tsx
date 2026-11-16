'use client';
import * as RM from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import { Children, type ReactNode } from 'react';
import { cn } from './cn';

/** A dropdown menu (the ⋯ menu, the Create menu, the profile menu). Radix handles focus and Escape. The look (V21):
 *  14 px corners, 8 px inside, rows 40 px tall with 10 px corners on the soft fill; it fades in and grows from 97% out
 *  of its button's corner in 160 ms, and leaves in 120 ms. */
export const Menu = RM.Root;
export const MenuTrigger = RM.Trigger;

export function MenuContent({ children, className, align = 'end', ...rest }: RM.DropdownMenuContentProps) {
  // An empty menu is a blank white box (F110): never render one — when every item is gated away, there is no menu.
  // Call sites hide the button too when they know nothing is behind it; this is the backstop for any menu whose
  // items are all conditional.
  if (Children.toArray(children).filter(Boolean).length === 0) return null;
  return (
    <RM.Portal>
      <RM.Content
        align={align}
        sideOffset={6}
        className={cn(
          'motion-menu z-50 min-w-56 origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-[14px] border border-border bg-raised p-2 text-text shadow-2',
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
  'flex h-10 cursor-default select-none items-center gap-2.5 whitespace-nowrap rounded-sm px-2.5 text-base text-strong outline-none data-[disabled]:text-muted data-[highlighted]:bg-surface [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted';

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
  return <RM.Label className="px-2.5 pb-1 pt-2 text-xs font-semibold text-muted">{children}</RM.Label>;
}

export function MenuSeparator() {
  return <RM.Separator className="-mx-2 my-2 h-px bg-border" />;
}

export function MenuRadioGroup(props: RM.DropdownMenuRadioGroupProps) {
  return <RM.RadioGroup {...props} />;
}

export function MenuRadioItem({ children, className, ...rest }: RM.DropdownMenuRadioItemProps) {
  return (
    <RM.RadioItem className={cn(menuItemClass, 'relative pe-8', className)} {...rest}>
      {children}
      <RM.ItemIndicator className="absolute end-2.5">
        <Check className="size-4 !text-strong" aria-hidden="true" />
      </RM.ItemIndicator>
    </RM.RadioItem>
  );
}
