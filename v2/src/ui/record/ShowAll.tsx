'use client';
import { useState, type ReactNode } from 'react';
import { Button } from '../Button';

/**
 * A long history shows its last few, then "Show all" (V81). `items` are already newest first; `initial` is how many
 * show at first. The control names the count, so the person knows what it opens.
 */
export function ShowAll({
  items,
  initial = 5,
  labels,
  render,
  className,
}: {
  items: ReactNode[];
  initial?: number;
  labels: { showAll: (count: number) => string; showLess: string };
  render?: (children: ReactNode) => ReactNode;
  className?: string;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, initial);
  const list = <>{shown}</>;
  return (
    <div className={className} data-show-all data-expanded={all || undefined}>
      {render ? render(list) : list}
      {items.length > initial ? (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAll((v) => !v)} data-show-all-toggle>
          {all ? labels.showLess : labels.showAll(items.length)}
        </Button>
      ) : null}
    </div>
  );
}
