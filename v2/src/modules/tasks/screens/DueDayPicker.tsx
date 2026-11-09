'use client';
import { DatePicker, DATE_MAX } from '@/ui/DatePicker';

export { DATE_MAX };

/**
 * Due on the task form (V286): the shared DatePicker with the due chips (Today, Tomorrow, Next week). The typed box,
 * the calendar popup and the parsing live in `src/ui/DatePicker` (FIX-02) — this file is only the due-date entry
 * point, so QuickAdd keeps working unchanged.
 */
export function DueDayPicker({
  id,
  value,
  onChange,
  describedBy,
  invalid,
}: {
  id: string;
  value: string | undefined;
  onChange: (due: string | undefined) => void;
  describedBy?: string;
  invalid?: true;
}) {
  return (
    <DatePicker
      id={id}
      value={value}
      onChange={onChange}
      describedBy={describedBy}
      invalid={invalid}
      chips="due"
      name="due"
    />
  );
}
