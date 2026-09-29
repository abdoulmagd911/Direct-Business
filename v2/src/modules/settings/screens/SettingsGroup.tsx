'use client';
import { useTranslations } from 'next-intl';
import type { SettingDefRow } from '../schema';
import { ListEditor, type ListEntry } from './ListEditor';
import { SettingCard, type Department } from './SettingCard';

/** A Settings group's page body: its settings, then its lists (V131, V133). */
export function SettingsGroup({
  settings,
  canEdit,
  departments,
  lists,
}: {
  settings: SettingDefRow[];
  canEdit: boolean;
  departments: Department[];
  lists: { key: string; label: string; rows: ListEntry[] }[];
}) {
  const t = useTranslations();
  return (
    <>
      {settings.map((def) => (
        <SettingCard key={def.key} def={def} departments={departments} canEdit={canEdit} />
      ))}
      {lists.map((l) => (
        <ListEditor key={l.key} entity={l.key} label={t.has(l.label) ? t(l.label) : l.key} rows={l.rows} />
      ))}
    </>
  );
}
