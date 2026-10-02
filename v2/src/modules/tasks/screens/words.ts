'use client';
import { useLocale, useTranslations } from 'next-intl';
import type { CommandWords } from '@/core/commands/run';
import { nameOf } from '@/modules/org/types';
import type { OrgAnswer } from '@/modules/org/types';
import { refusalKey } from '../rules';
import type { NamePick, TaskRow } from '../types';

/** The command words for a task write: the done line, Undo, and a refusal in the Tasks catalog's words first. */
export function useCommandWords(): (done: string) => CommandWords {
  const t = useTranslations();
  return (done) => ({
    done,
    undo: t('common.undo'),
    undone: t('activity.undone'),
    has: (k) => t.has(refusalKey(k)),
    failed: (k, d) => t(refusalKey(k), { detail: d }),
  });
}

/** Names in the language on screen: a person, a client or project, a status. */
export function useNames(org: OrgAnswer | null, partners: NamePick[], projects: NamePick[]) {
  const locale = useLocale() as 'en' | 'ar';
  const t = useTranslations();
  const pick = (x: { name_en: string; name_ar: string | null } | undefined) =>
    x ? (locale === 'ar' && x.name_ar ? x.name_ar : x.name_en) : '';
  return {
    locale,
    person: (id: string | null) => {
      if (!id) return t('pages.tasks.unknownOwner');
      const p = org?.people.find((x) => x.id === id);
      return p ? nameOf(p, locale) : '—';
    },
    partner: (id: string | null) => (id ? pick(partners.find((p) => p.id === id)) || '—' : ''),
    project: (id: string | null) => (id ? pick(projects.find((p) => p.id === id)) || '—' : ''),
    status: (r: Pick<TaskRow, 'status_en' | 'status_ar'>) => (locale === 'ar' ? r.status_ar : r.status_en),
  };
}
