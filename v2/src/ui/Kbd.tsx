import { cn } from './cn';

export function Kbd({ children, className }: { children: string; className?: string }) {
  return (
    <kbd className={cn('rounded-sm border border-current/30 px-1.5 font-data text-[11px] leading-[18px]', className)}>
      {children}
    </kbd>
  );
}
