'use client';
import { Check, MoreHorizontal, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMe } from '@/core/auth/me-context';
import { isAdmin } from './shell/nav';
import type { CommandWords } from '@/core/commands/command';
import { useSavedViews, type SavedView } from '@/core/views/useSavedViews';
import { Button } from './Button';
import { cn } from './cn';
import { Confirm } from './Confirm';
import { Dialog } from './Dialog';
import { Field } from './Field';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { Menu, MenuContent, MenuItem, MenuTrigger } from './Menu';
import { Switch } from './Switch';

/**
 * Saved views across the top of a list (§3.3, V61, V78): the page's fixed views first, then each saved one (mine,
 * or shared by a colleague) as a pill; the open one is pressed. "Save view" keeps the current filters under a name
 * (shared only with Full on the page); each saved view's menu sets it as my default or removes it (soft — one Undo,
 * and Recently deleted). The bar reads api.views and re-reads after every command.
 */
export function SavedViewsBar({
  page,
  fixed,
  current,
  query,
  onOpen,
  canShare,
  className,
}: {
  page: string;
  /** The page's own views (All, Government …), by key. */
  fixed: { key: string; label: string }[];
  /** The open view: a fixed key or a saved view's id. */
  current: string;
  /** The filters as they stand, saved under a name. */
  query: Record<string, unknown>;
  onOpen: (view: { key: string; query?: Record<string, unknown> }) => void;
  canShare: boolean;
  className?: string;
}) {
  const admin = isAdmin(useMe());
  const t = useTranslations();
  const words: CommandWords = {
    done: t('views.saved'),
    undo: t('common.undo'),
    undone: t('activity.undone'),
    has: (k) => t.has(k),
    failed: (k, d) => t(k, { detail: d }),
  };
  const { views, failed, reload, save, setDefault, remove } = useSavedViews(page, words);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const [removing, setRemoving] = useState<SavedView | null>(null);
  const pill = (active: boolean) =>
    cn(
      'inline-flex h-[var(--control-h-sm)] items-center gap-1.5 whitespace-nowrap rounded-pill border px-3.5 text-sm transition-colors duration-[var(--dur)] focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2',
      active ? 'border-accent bg-accent-soft text-text' : 'border-border bg-transparent text-muted hover:bg-surface',
    );
  const submit = async () => {
    const r = await save({ name: name.trim(), query, shared });
    if (r) {
      setSaving(false);
      setName('');
      setShared(false);
      if (r.id) onOpen({ key: r.id, query });
    }
  };
  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      role="group"
      aria-label={t('views.label')}
      data-saved-views
    >
      {fixed.map((f) => (
        <button
          key={f.key}
          type="button"
          aria-pressed={current === f.key}
          onClick={() => onOpen({ key: f.key })}
          className={pill(current === f.key)}
          data-view={f.key}
        >
          {f.label}
        </button>
      ))}
      {(views ?? []).map((v) => (
        <span key={v.id} className="inline-flex items-center" data-saved-view={v.id}>
          <button
            type="button"
            aria-pressed={current === v.id}
            onClick={() => onOpen({ key: v.id, query: v.query })}
            className={cn(pill(current === v.id), 'pe-2')}
          >
            {v.default ? (
              <>
                <Star className="size-3.5 fill-current" aria-hidden="true" data-view-default-mark />
                <span className="sr-only">{t('views.default')}</span>
              </>
            ) : null}
            {v.name}
          </button>
          <Menu>
            <MenuTrigger asChild>
              <IconButton
                label={t('views.menu', { name: v.name })}
                icon={<MoreHorizontal />}
                size="sm"
                data-view-menu
              />
            </MenuTrigger>
            <MenuContent>
              {!v.default ? (
                <MenuItem icon={<Check />} onSelect={() => void setDefault(v.id)} data-view-default>
                  {t('views.setDefault')}
                </MenuItem>
              ) : null}
              {v.mine || admin ? (
                <MenuItem onSelect={() => setRemoving(v)} data-view-remove>
                  {t('common.remove')}
                </MenuItem>
              ) : null}
            </MenuContent>
          </Menu>
        </span>
      ))}
      {failed ? (
        // A failed read is said, never drawn as "no saved views" (the old app's lesson).
        <Button size="sm" variant="ghost" onClick={() => void reload()} data-views-failed>
          {t('state.failed', { what: t('views.label') })} · {t('common.tryAgain')}
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" onClick={() => setSaving(true)} data-view-save>
        {t('views.save')}
      </Button>
      <Dialog
        open={saving}
        onOpenChange={setSaving}
        title={t('views.saveTitle')}
        size="sm"
        closeLabel={t('common.close')}
        dirty={name !== ''}
        footer={
          <>
            <Button onClick={() => setSaving(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" disabled={!name.trim()} onClick={() => void submit()} data-view-save-confirm>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label={t('views.name')}>
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}
          </Field>
          {canShare ? <Switch checked={shared} onCheckedChange={setShared} label={t('views.shared')} /> : null}
        </div>
      </Dialog>
      <Confirm
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t('confirm.title', { item: removing?.name ?? '' })}
        body={t('confirm.body', { item: removing?.name ?? '' })}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('common.remove')}
        onConfirm={async () => {
          const v = removing!;
          setRemoving(null);
          await remove([v.id], t('views.removed', { name: v.name }));
          if (current === v.id) onOpen({ key: fixed[0]?.key ?? '' });
        }}
      />
    </div>
  );
}
