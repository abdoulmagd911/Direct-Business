'use client';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import * as RD from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';
import { useMe } from '@/core/auth/me-context';
import { canSee } from '../person';
import { SETTINGS_ENTRY, isAdmin, navFor } from './nav';
import { CREATE_ACTIONS } from './CreateMenu';

/**
 * Ctrl K: pages and create actions now; records through api.search from P3-9 (search providers come
 * from the registry). Opens from the top-bar search or the shortcut; Escape closes and focus returns.
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations();
  const me = useMe();
  const router = useRouter();
  const [q, setQ] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const close = (o: boolean) => {
    if (!o) setQ('');
    onOpenChange(o);
  };
  const go = (route: string) => {
    close(false);
    router.push(route);
  };
  const pages = [...navFor(me), ...(isAdmin(me) ? [SETTINGS_ENTRY] : [])];

  return (
    <RD.Root open={open} onOpenChange={close}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <RD.Content
          aria-describedby={undefined}
          className="fixed inset-x-4 top-[12vh] z-50 mx-auto w-auto max-w-[620px] overflow-hidden rounded-lg border border-border bg-raised text-text shadow-2 focus:outline-none"
          data-command-palette
        >
          <RD.Title className="sr-only">{t('top.searchLabel')}</RD.Title>
          <Command label={t('top.searchLabel')} loop>
            <div className="flex items-center gap-2.5 border-b border-border px-4">
              <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
              <Command.Input
                value={q}
                onValueChange={setQ}
                placeholder={t('palette.placeholder')}
                className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted"
              />
            </div>
            <Command.List className="max-h-[360px] overflow-y-auto p-1.5">
              <Command.Empty className="px-3 py-6 text-center text-base text-muted">{t('palette.empty')}</Command.Empty>
              <Command.Group
                heading={t('palette.pages')}
                className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[.07em] [&_[cmdk-group-heading]]:text-muted"
              >
                {pages.map((p) => {
                  const Icon = p.icon;
                  return (
                    <Command.Item
                      key={p.key}
                      value={t(p.label)}
                      onSelect={() => go(p.route)}
                      className="flex h-10 cursor-default select-none items-center gap-2.5 rounded-md px-2.5 text-base data-[selected=true]:bg-accent-soft"
                    >
                      <Icon className="size-4 text-muted" aria-hidden="true" />
                      {t(p.label)}
                    </Command.Item>
                  );
                })}
              </Command.Group>
              <Command.Group
                heading={t('palette.actions')}
                className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[.07em] [&_[cmdk-group-heading]]:text-muted"
              >
                {CREATE_ACTIONS.filter((a) => canSee(me, a.page)).map((a) => {
                  const Icon = a.icon;
                  return (
                    <Command.Item
                      key={a.key}
                      value={`${t('top.create')} ${t(`create.${a.key}`)}`}
                      onSelect={() => go(a.route)}
                      className="flex h-10 cursor-default select-none items-center gap-2.5 rounded-md px-2.5 text-base data-[selected=true]:bg-accent-soft"
                    >
                      <Icon className="size-4 text-muted" aria-hidden="true" />
                      {t('top.create')} · {t(`create.${a.key}`)}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            </Command.List>
          </Command>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
