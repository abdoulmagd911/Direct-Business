'use client';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { command, type CommandWords, type Written } from '@/core/commands/command';
import { Button } from './Button';
import { cn } from './cn';
import { IconButton } from './IconButton';

export type BulkAction = {
  key: string;
  label: string;
  icon?: ReactNode;
  /** One api.* call for every selected id — one request, one Undo (§3.3). */
  run: (ids: string[]) => Promise<Written>;
  /** The done line, e.g. "12 assigned to Sara". */
  done: (count: number) => string;
  variant?: 'primary' | 'secondary' | 'danger';
};

/**
 * The bulk bar over a list with rows selected (§3.3, V61): the count, the actions, Clear. An action is one command for
 * the whole selection — the database writes it as one request, so the toast's Undo reverts all of it.
 */
export function BulkBar({
  ids,
  actions,
  onClear,
  className,
}: {
  ids: string[];
  actions: BulkAction[];
  onClear: () => void;
  className?: string;
}) {
  const t = useTranslations();
  const [busy, setBusy] = useState<string | null>(null);
  if (!ids.length) return null;
  const words = (done: string): CommandWords => ({
    done,
    undo: t('common.undo'),
    undone: t('activity.undone'),
    has: (k) => t.has(k),
    failed: (k, d) => t(k, { detail: d }),
  });
  const fire = async (a: BulkAction) => {
    setBusy(a.key);
    await command(words(a.done(ids.length)), () => a.run(ids), { after: onClear });
    setBusy(null);
  };
  return (
    <div
      role="region"
      aria-label={t('table.selected', { count: ids.length })}
      className={cn(
        'sticky bottom-4 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-lg border border-border bg-raised px-3 py-2 shadow-2',
        className,
      )}
      data-bulk-bar
    >
      <span className="font-data text-sm" data-bulk-count>
        {t('table.selected', { count: ids.length })}
      </span>
      {actions.map((a) => (
        <Button
          key={a.key}
          size="sm"
          variant={a.variant === 'danger' ? 'danger' : a.variant === 'primary' ? 'primary' : undefined}
          icon={a.icon}
          loading={busy === a.key}
          disabled={busy !== null}
          onClick={() => void fire(a)}
          data-bulk-action={a.key}
        >
          {a.label}
        </Button>
      ))}
      <IconButton label={t('table.clearSelection')} icon={<X />} size="sm" onClick={onClear} data-bulk-clear />
    </div>
  );
}
