'use client';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import * as RD from '@radix-ui/react-dialog';
import { Building2, Search, UserRound } from 'lucide-react';
import { useMe } from '@/core/auth/me-context';
import { paletteActions } from '@/core/commands/actions';
import { rpc } from '@/core/db/rpc';
import { canSee } from '../person';
import { SETTINGS_ENTRY, isAdmin, navFor } from './nav';
import { CREATE_ACTIONS } from './CreateMenu';

type Hit = { id: string; full_name_en: string; full_name_ar: string | null; job_title_en: string | null };
type OrgHit = { id: string; number: string; trade_name_en: string; trade_name_ar: string | null; matched_by: string };

const itemClass =
  'flex h-10 cursor-default select-none items-center gap-2.5 rounded-md px-2.5 text-base data-[selected=true]:bg-accent-soft';
const groupClass =
  '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[.07em] [&_[cmdk-group-heading]]:text-muted';

/**
 * Ctrl K (V401): Go to a page; people by name through api.search (organisations join when their record page lands,
 * P3-9); the Create actions; and the actions each step registers (New task · Log activity · New invoice) — only the
 * ones whose page the person may see. Opens from the top-bar search or the shortcut; Escape closes and focus returns.
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations();
  const me = useMe();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ term: string; people: Hit[]; partners: OrgHit[] }>({
    term: '',
    people: [],
    partners: [],
  });
  // People by name: two letters or more (api.search's own floor); only the answer to the term as typed now shows.
  const term = q.trim();
  useEffect(() => {
    if (!open || term.length < 2) return;
    let live = true;
    rpc('search', { p_q: term, p_limit: 8 })
      .then(
        (a) =>
          live &&
          setFound({
            term,
            people: ((a as { people?: Hit[] } | null)?.people ?? []).slice(0, 8),
            partners: ((a as { partners?: OrgHit[] } | null)?.partners ?? []).slice(0, 8),
          }),
      )
      .catch(() => live && setFound({ term, people: [], partners: [] }));
    return () => {
      live = false;
    };
  }, [term, open]);
  const people = open && term.length >= 2 && found.term === term ? found.people : [];
  const partners = open && term.length >= 2 && found.term === term ? found.partners : [];

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
  const actions = paletteActions().filter((a) => canSee(me, a.page));

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
              <Command.Group heading={t('palette.pages')} className={groupClass}>
                {pages.map((p) => {
                  const Icon = p.icon;
                  return (
                    <Command.Item key={p.key} value={t(p.label)} onSelect={() => go(p.route)} className={itemClass}>
                      <Icon className="size-4 text-muted" aria-hidden="true" />
                      {t(p.label)}
                    </Command.Item>
                  );
                })}
              </Command.Group>
              {partners.length ? (
                <Command.Group heading={t('palette.organisations')} className={groupClass}>
                  {partners.map((p) => (
                    <Command.Item
                      key={p.id}
                      value={`${p.trade_name_en} ${p.trade_name_ar ?? ''} ${p.number} ${p.id}`}
                      onSelect={() => go(`/partners/${p.id}`)}
                      className={itemClass}
                      data-palette-partner={p.id}
                    >
                      <Building2 className="size-4 text-muted" aria-hidden="true" />
                      <span className="truncate">{p.trade_name_en}</span>
                      <span className="font-data text-sm text-muted">{p.number}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {people.length ? (
                <Command.Group heading={t('palette.people')} className={groupClass}>
                  {people.map((p) => (
                    <Command.Item
                      key={p.id}
                      value={`${p.full_name_en} ${p.full_name_ar ?? ''} ${p.id}`}
                      onSelect={() => go(`/people/${p.id}`)}
                      className={itemClass}
                      data-palette-person={p.id}
                    >
                      <UserRound className="size-4 text-muted" aria-hidden="true" />
                      <span className="truncate">{p.full_name_en}</span>
                      {p.job_title_en ? <span className="truncate text-sm text-muted">{p.job_title_en}</span> : null}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              <Command.Group heading={t('palette.actions')} className={groupClass}>
                {CREATE_ACTIONS.filter((a) => canSee(me, a.page)).map((a) => {
                  const Icon = a.icon;
                  return (
                    <Command.Item
                      key={a.key}
                      value={`${t('top.create')} ${t(`create.${a.key}`)}`}
                      onSelect={() => go(a.route)}
                      className={itemClass}
                    >
                      <Icon className="size-4 text-muted" aria-hidden="true" />
                      {t('top.create')} · {t(`create.${a.key}`)}
                    </Command.Item>
                  );
                })}
                {actions.map((a) => {
                  const Icon = a.icon;
                  return (
                    <Command.Item
                      key={a.key}
                      value={t(a.label)}
                      onSelect={() => go(a.route)}
                      className={itemClass}
                      data-palette-action={a.key}
                    >
                      <Icon className="size-4 text-muted" aria-hidden="true" />
                      {t(a.label)}
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
