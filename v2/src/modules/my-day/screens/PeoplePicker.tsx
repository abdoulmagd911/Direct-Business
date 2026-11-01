'use client';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Input } from '@/ui/Input';
import { paletteMatches } from '@/ui/shell/palette-match';

/**
 * Colleagues to share a note with, found by typing a name (the list narrows as the person types; nothing typed shows
 * everyone left). One press on a name adds it, the box clears and the list closes; it opens again on the next tap or key. Names already chosen are not
 * offered again. Every row is a finger-high target on a phone.
 */
export function PeoplePicker({
  options,
  onPick,
  id,
}: {
  options: { id: string; name: string }[];
  onPick: (id: string) => void;
  id?: string;
}) {
  const t = useTranslations();
  const list = useId();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const hits = options.filter((o) => paletteMatches(o.name, q));
  return (
    <div
      className="flex flex-col gap-1"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
      data-people-picker
    >
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={list}
        aria-label={t('pages.myDay.visibility.shareAdd')}
        placeholder={t('pages.myDay.visibility.shareSearch')}
        autoComplete="off"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        data-people-search
      />
      {open ? (
        <ul
          id={list}
          role="listbox"
          className="flex max-h-64 flex-col overflow-y-auto rounded-md border border-border bg-raised p-1"
          data-people-hits
        >
          {hits.length ? (
            hits.map((o) => (
              <li key={o.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  onClick={() => {
                    onPick(o.id);
                    setQ('');
                    setOpen(false);
                  }}
                  className="flex min-h-11 w-full items-center rounded-md px-2.5 text-start break-words hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-focus sm:min-h-10"
                  data-people-hit={o.id}
                >
                  {o.name}
                </button>
              </li>
            ))
          ) : (
            <li className="px-2.5 py-2 text-sm text-muted">{t('pages.myDay.visibility.shareNone')}</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
