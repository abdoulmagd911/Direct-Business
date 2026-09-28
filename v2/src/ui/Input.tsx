'use client';
import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

export const inputClass =
  'w-full rounded-md border border-border-strong bg-raised px-3 text-base text-text placeholder:text-muted disabled:bg-surface disabled:text-muted focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1 aria-invalid:border-danger';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }>(
  function Input({ className, mono, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(inputClass, 'h-[var(--control-h)]', mono && 'font-data tabular', className)}
        {...rest}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(inputClass, 'py-2 leading-normal', className)} {...rest} />;
});
