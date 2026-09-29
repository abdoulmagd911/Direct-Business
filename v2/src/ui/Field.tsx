import { useId, type ReactNode } from 'react';
import { cn } from './cn';

/**
 * A label above its control. `error` is the one sentence a refused value gets (in words, in place) —
 * there is no helper text and no hint slot on purpose (V11).
 */
export function Field({
  label,
  error,
  children,
  className,
  id,
}: {
  label: ReactNode;
  error?: string;
  children: (props: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode;
  className?: string;
  id?: string;
}) {
  const auto = useId();
  const controlId = id ?? auto;
  const errorId = `${controlId}-error`;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={controlId} className="text-sm font-medium text-text">
        {label}
      </label>
      {children({
        id: controlId,
        ...(error ? { 'aria-invalid': true as const, 'aria-describedby': errorId } : {}),
      })}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
