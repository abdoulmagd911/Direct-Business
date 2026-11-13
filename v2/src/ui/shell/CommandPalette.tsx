'use client';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import * as RD from '@radix-ui/react-dialog';
import { Building2, CheckSquare, History, Search, Tag, UserRound } from 'lucide-react';
import { useMe } from '@/core/auth/me-context';
import { paletteActions, registerActions } from '@/core/commands/actions';
import { rpc } from '@/core/db/rpc';
import { canSee } from '../person';
import { reachableFor } from './nav';
import { openQuickCapture } from '@/modules/my-day/quick-capture';
import { tradeName } from '@/modules/partners/types';
import { createActionsFor } from './CreateMenu';
import { paletteMatches } from './palette-match';

// Recently deleted is everyone's own (V401): with the profile chip down to My profile and Sign out (V217, cut 5), a
// person without Activity reaches it here.
registerActions([
  {
    key: 'recently_deleted',
    label: 'palette.recentlyDeleted',
    icon: History,
    page: 'settings.profile',
    route: '/recently-deleted',
  },
]);

type Hit = { id: string; full_name_en: string; full_name_ar: string | null; job_title_en: string | null };
type OrgHit = { id: string; number: string; trade_name_en: string; trade_name_ar: string | null; matched_by: string };
// a discount code the reader may see, by its text (F-B1-01)
type CodeHit = { id: string; code: string; state: 'active' | 'inactive' | 'expired' };
// a task the reader may see (api.search reads it by its row level), by its number and title, or by a checklist item
type TaskHit = { id: string; number: string; title: string; closed: boolean; item?: string | null };

const itemClass =
  'flex h-11 cursor-default select-none items-center gap-2.5 rounded-md px-2.5 text-base data-[selected=true]:bg-accent-soft sm:h-10';
const groupClass =
  '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[.07em] [&_[cmdk-group-heading]]:text-muted';

/**
 * Ctrl K (V401): Go to a page; organisations, people, tasks and discount codes the reader may see — through
 * api.search; the Create actions; and the actions each step registers (New task · Log activity · New invoice) —
 * only the ones whose page the person may see. Captured notes are NOT here (F-B3-03, Landing 15): the search
 * answers no notes group. Opens from the top-bar search or the shortcut; Escape closes and focus returns.
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const me = useMe();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{
    term: string;
    people: Hit[];
    partners: OrgHit[];
    codes: CodeHit[];
    tasks: TaskHit[];
  }>({
    term: '',
    people: [],
    partners: [],
    codes: [],
    tasks: [],
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
            codes: ((a as { codes?: CodeHit[] } | null)?.codes ?? []).slice(0, 8),
            tasks: ((a as { tasks?: TaskHit[] } | null)?.tasks ?? []).slice(0, 8),
          }),
      )
      .catch(() => live && setFound({ term, people: [], partners: [], codes: [], tasks: [] }));
    return () => {
      live = false;
    };
  }, [term, open]);
  const people = open && term.length >= 2 && found.term === term ? found.people : [];
  const partners = open && term.length >= 2 && found.term === term ? found.partners : [];
  const codes = open && term.length >= 2 && found.term === term ? found.codes : [];
  const tasks = open && term.length >= 2 && found.term === term ? found.tasks : [];
  // FIX-13(a): while the search for the term as typed is still on its way, the palette says so — the "Nothing
  // matches" empty state only shows once the answer for this term has settled.
  const searching = open && term.length >= 2 && found.term !== term;

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
  // cmdk's own filter is off (QA-72): a person the server found by a nickname or a folded Arabic spelling stays; the
  // pages and actions are filtered here, on the words as shown
  const matches = (label: string) => paletteMatches(label, term);
  const pages = reachableFor(me).filter((p) => matches(t(p.label)));
  const actions = paletteActions().filter((a) => canSee(me, a.page) && matches(t(a.label)));
  const createActions = createActionsFor(me).filter((a) => matches(`${t('top.create')} · ${t(`create.${a.key}`)}`));
  const personName = (p: Hit) => (locale === 'ar' && p.full_name_ar ? p.full_name_ar : p.full_name_en);

  // On a phone the search box takes focus and the keyboard opens at once: the list ends above it (`--kb`), and the
  // box is placed by the visible height (`dvh`), so no answer sits hidden under the keyboard or the address bar.
  return (
    <RD.Root open={open} onOpenChange={close}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <RD.Content
          aria-describedby={undefined}
          className="fixed inset-x-4 top-[12dvh] z-50 mx-auto w-auto max-w-[620px] overflow-hidden rounded-lg border border-border bg-raised text-text shadow-2 focus:outline-none"
          data-command-palette
        >
          <RD.Title className="sr-only">{t('top.searchLabel')}</RD.Title>
          <Command label={t('top.searchLabel')} loop shouldFilter={false}>
            <div className="flex items-center gap-2.5 border-b border-border px-4">
              <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
              <Command.Input
                value={q}
                onValueChange={setQ}
                placeholder={t('palette.placeholder')}
                className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted"
              />
            </div>
            <Command.List className="max-h-[min(360px,calc(84dvh-var(--kb,0px)-3rem))] overflow-y-auto p-1.5">
              {searching ? (
                <Command.Item
                  value="searching"
                  disabled
                  className="flex h-11 cursor-default select-none items-center gap-2.5 rounded-md px-2.5 text-base text-muted sm:h-10"
                  data-palette-searching
                >
                  {t('palette.searching')}
                </Command.Item>
              ) : null}
              <Command.Empty className="px-3 py-6 text-center text-base text-muted">{t('palette.empty')}</Command.Empty>
              {pages.length ? (
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
              ) : null}
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
                      <span className="truncate">{tradeName(p, locale === 'ar' ? 'ar' : 'en')}</span>
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
                      <span className="truncate">{personName(p)}</span>
                      {p.job_title_en ? <span className="truncate text-sm text-muted">{p.job_title_en}</span> : null}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {tasks.length ? (
                <Command.Group heading={t('nav.tasks')} className={groupClass}>
                  {tasks.map((k) => (
                    <Command.Item
                      key={k.id}
                      value={`${k.number} ${k.title} ${k.id}`}
                      onSelect={() => go(`/tasks/${k.number}`)}
                      className={itemClass}
                      data-palette-task={k.id}
                    >
                      <CheckSquare className="size-4 shrink-0 text-muted" aria-hidden="true" />
                      <span className="truncate">
                        {k.title}
                        {k.item ? (
                          <span className="text-muted" data-palette-item>
                            {' · '}
                            {k.item}
                          </span>
                        ) : null}
                      </span>
                      <span className="ms-auto shrink-0 font-data text-sm text-muted">{k.number}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {codes.length ? (
                <Command.Group heading={t('search.codes.group')} className={groupClass}>
                  {codes.map((c) => (
                    <Command.Item
                      key={c.id}
                      value={`${c.code} ${c.id}`}
                      onSelect={() => go(`/codes?code=${c.id}`)}
                      className={itemClass}
                      data-palette-code={c.id}
                    >
                      <Tag className="size-4 shrink-0 text-muted" aria-hidden="true" />
                      <span className="truncate font-data">{c.code}</span>
                      <span className="ms-auto shrink-0 text-sm text-muted">{t(`pages.codes.filter.${c.state}`)}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {createActions.length || actions.length ? (
                <Command.Group heading={t('palette.actions')} className={groupClass}>
                  {createActions.map((a) => {
                    const Icon = a.icon;
                    return (
                      <Command.Item
                        key={a.key}
                        value={`${t('top.create')} ${t(`create.${a.key}`)}`}
                        onSelect={() =>
                          a.dialog
                            ? (close(false), a.dialog())
                            : a.sheet
                              ? (close(false), openQuickCapture(a.kind ? { kind: a.kind } : undefined))
                              : go(a.route)
                        }
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
              ) : null}
            </Command.List>
          </Command>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
