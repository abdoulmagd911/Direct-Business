'use client';
import { Building2, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { rpc } from '@/core/db/rpc';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import type { PartnerRef } from '../types';

const nameOf = (p: PartnerRef, locale: string) =>
  locale === 'ar' && p.trade_name_ar ? p.trade_name_ar : p.trade_name_en;

/**
 * An organisation by name or number (api.search's organisations, two letters or more — the same search as Ctrl K). The
 * chosen one shows as a chip with a clear button; nothing is picked for the person.
 */
export function PartnerPicker({
  value,
  onChange,
  id,
}: {
  value: PartnerRef | null;
  onChange: (p: PartnerRef | null) => void;
  id?: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const list = useId();
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ term: string; hits: PartnerRef[] }>({ term: '', hits: [] });
  const term = q.trim();
  useEffect(() => {
    if (value || term.length < 2) return;
    let live = true;
    rpc('search', { p_q: term, p_limit: 8 })
      .then((a) => live && setFound({ term, hits: (a as { partners?: PartnerRef[] } | null)?.partners ?? [] }))
      .catch(() => live && setFound({ term, hits: [] }));
    return () => {
      live = false;
    };
  }, [term, value]);
  const hits = term.length >= 2 && found.term === term ? found.hits : [];

  if (value)
    return (
      <span
        className="inline-flex min-h-[var(--control-h)] items-center gap-2 rounded-md border border-border bg-surface ps-3"
        data-partner-picked={value.id}
      >
        <Building2 className="size-4 text-muted" aria-hidden="true" />
        <span className="truncate">{nameOf(value, locale)}</span>
        <span className="font-data text-sm text-muted">{value.number}</span>
        <IconButton label={t('common.remove')} icon={<X />} size="sm" onClick={() => onChange(null)} />
      </span>
    );
  return (
    <div className="flex flex-col gap-1">
      <Input
        id={id}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('pages.myDay.turn.searchOrg')}
        autoComplete="off"
        aria-controls={list}
        data-partner-search
      />
      {term.length >= 2 && found.term === term ? (
        <ul id={list} className="flex flex-col rounded-md border border-border bg-raised p-1" data-partner-hits>
          {hits.length ? (
            hits.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(p);
                    setQ('');
                  }}
                  className="flex min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-start hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-focus"
                  data-partner-hit={p.id}
                >
                  <Building2 className="size-4 shrink-0 text-muted" aria-hidden="true" />
                  <span className="truncate">{nameOf(p, locale)}</span>
                  <span className="font-data text-sm text-muted">{p.number}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-2.5 py-2 text-sm text-muted">{t('pages.myDay.turn.noOrg')}</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
