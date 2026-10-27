'use client';
import { Building2, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { rpc } from '@/core/db/rpc';
import { IconButton } from '@/ui/IconButton';
import { cn } from '@/ui/cn';
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
  const [active, setActive] = useState(0);
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
  const current = Math.min(active, Math.max(hits.length - 1, 0));
  const pick = (p: PartnerRef) => {
    onChange(p);
    setQ('');
    setActive(0);
  };

  if (value)
    return (
      <span
        className="inline-flex min-h-[var(--control-h)] max-w-full items-center gap-2 rounded-md border border-border bg-surface ps-3"
        data-partner-picked={value.id}
      >
        <Building2 className="size-4 shrink-0 text-muted" aria-hidden="true" />
        {/* as in the list below: the name wraps over as many lines as it needs and is never cut with an ellipsis; the code
            sits on its own line under it and never breaks in the middle */}
        <span className="flex min-w-0 flex-1 flex-col py-1">
          <span className="min-w-0 [overflow-wrap:anywhere]" data-partner-picked-name>
            {nameOf(value, locale)}
          </span>
          <span className="font-data text-sm whitespace-nowrap text-muted" data-partner-picked-number>
            {value.number}
          </span>
        </span>
        <IconButton label={t('common.remove')} icon={<X />} size="sm" onClick={() => onChange(null)} />
      </span>
    );
  return (
    <div className="flex flex-col gap-1">
      <Input
        id={id}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        // the keyboard: arrows move the highlight, Enter picks the highlighted row (the first one at the start)
        onKeyDown={(e) => {
          if (!hits.length) return;
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((current + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const h = hits[current];
            if (h) pick(h);
          }
        }}
        placeholder={t('pages.myDay.turn.searchOrg')}
        autoComplete="off"
        role="combobox"
        aria-expanded={hits.length > 0}
        aria-autocomplete="list"
        aria-controls={list}
        aria-activedescendant={hits.length ? `${list}-${current}` : undefined}
        data-partner-search
      />
      {term.length >= 2 && found.term === term ? (
        <ul
          id={list}
          role="listbox"
          className="flex flex-col rounded-md border border-border bg-raised p-1"
          data-partner-hits
        >
          {hits.length ? (
            hits.map((p, i) => (
              <li key={p.id} role="presentation">
                <button
                  type="button"
                  id={`${list}-${i}`}
                  role="option"
                  aria-selected={i === current}
                  // one click or tap picks the row: the press itself does it (and keeps the search box focused, so the
                  // list is not rebuilt under the finger); a keyboard press arrives as a click and does the same
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(p);
                  }}
                  onClick={(e) => {
                    if (e.detail === 0) pick(p);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    'flex min-h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-start hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-focus sm:min-h-10',
                    i === current && 'bg-accent-soft',
                  )}
                  data-partner-hit={p.id}
                >
                  <Building2 className="size-4 shrink-0 text-muted" aria-hidden="true" />
                  {/* the name wraps (onto as many lines as it needs, a long word breaks) and is never cut with an ellipsis;
                      the code sits on its own line under it and never breaks in the middle */}
                  <span className="flex min-w-0 flex-1 flex-col py-1">
                    <span className="min-w-0 [overflow-wrap:anywhere]" data-partner-hit-name>
                      {nameOf(p, locale)}
                    </span>
                    <span className="font-data text-sm whitespace-nowrap text-muted" data-partner-hit-number>
                      {p.number}
                    </span>
                  </span>
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
