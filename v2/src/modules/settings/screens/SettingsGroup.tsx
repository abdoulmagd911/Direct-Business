'use client';
import { useTranslations } from 'next-intl';
import { DataState } from '@/ui/DataState';
import type { SettingDefRow } from '../schema';
import type { ChoiceNames } from '../words';
import { ListEditor, type ListEntry } from './ListEditor';
import { SettingCard, type Department } from './SettingCard';

/** A Settings group's page body: its settings, then its lists (V131, V133). */
export function SettingsGroup({
  settings,
  canEdit,
  departments,
  lists,
  today,
  names,
}: {
  settings: SettingDefRow[];
  canEdit: boolean;
  departments: Department[];
  lists: { key: string; label: string; rows: ListEntry[] }[];
  /** Riyadh's date on the server, for the day a change applies from. */
  today: string;
  /** The entries of the lists that some settings' values are keys of (LIST_VALUES). */
  names?: ChoiceNames;
}) {
  const t = useTranslations();
  if (!settings.length && !lists.length) return <DataState kind="empty" message={t('settings.emptyGroup')} />;
  return (
    <>
      {settings.map((def) => (
        <SettingCard key={def.key} def={def} departments={departments} canEdit={canEdit} today={today} names={names} />
      ))}
      {lists.map((l) => (
        <ListEditor key={l.key} entity={l.key} label={t.has(l.label) ? t(l.label) : l.key} rows={l.rows} />
      ))}
    </>
  );
}
