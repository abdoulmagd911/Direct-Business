import { cn } from './cn';

export function Kbd({ children, className }: { children: string; className?: string }) {
  return (
    <kbd
      className={cn(
        'rounded-[6px] border border-border-strong bg-surface px-1.5 font-ui text-xs font-medium leading-[18px] text-muted',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
