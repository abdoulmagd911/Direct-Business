'use client';
import { ListChecks, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { rpc } from '@/core/db/rpc';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';

/** A task the reader may see, as api.search answers it. */
export type TaskRef = { id: string; number: string; title: string; closed: boolean };

/**
 * A task by title or number (api.search's tasks, two letters or more — the same search as Ctrl K, which reads only what
 * the person may see). The chosen one shows as a chip with a clear button; nothing is picked for the person (V647).
 */
export function TaskPicker({
  value,
  onChange,
  id,
}: {
  value: TaskRef | null;
  onChange: (t: TaskRef | null) => void;
  id?: string;
}) {
  const t = useTranslations();
  const list = useId();
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ term: string; hits: TaskRef[] }>({ term: '', hits: [] });
  const term = q.trim();
  useEffect(() => {
    if (value || term.length < 2) return;
    let live = true;
    rpc('search', { p_q: term, p_limit: 8 })
      .then((a) => live && setFound({ term, hits: (a as { tasks?: TaskRef[] } | null)?.tasks ?? [] }))
      .catch(() => live && setFound({ term, hits: [] }));
    return () => {
      live = false;
    };
  }, [term, value]);
  const hits = term.length >= 2 && found.term === term ? found.hits.filter((h) => !h.closed) : [];

  if (value)
    return (
      <span
        className="inline-flex min-h-[var(--control-h)] items-center gap-2 rounded-md border border-border bg-surface ps-3"
        data-task-picked={value.id}
      >
        <ListChecks className="size-4 text-muted" aria-hidden="true" />
        <span className="truncate">{value.title}</span>
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
        placeholder={t('pages.myDay.turn.searchTask')}
        autoComplete="off"
        aria-controls={list}
        data-task-search
      />
      {term.length >= 2 && found.term === term ? (
        <ul id={list} className="flex flex-col rounded-md border border-border bg-raised p-1" data-task-hits>
          {hits.length ? (
            hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(h);
                    setQ('');
                  }}
                  className="flex min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-start hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-focus"
                  data-task-hit={h.id}
                >
                  <ListChecks className="size-4 shrink-0 text-muted" aria-hidden="true" />
                  <span className="truncate">{h.title}</span>
                  <span className="font-data text-sm text-muted">{h.number}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-2.5 py-2 text-sm text-muted">{t('pages.myDay.turn.noTask')}</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
