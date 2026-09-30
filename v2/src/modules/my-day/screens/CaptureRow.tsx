'use client';
import { ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { command } from '@/core/commands/command';
import { today, useWords } from '@/modules/partners/screens/record/words';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Menu, MenuContent, MenuRadioGroup, MenuRadioItem, MenuTrigger } from '@/ui/Menu';
import { door } from '../doors';
import { noteRoute, parseCapture, SLASH } from '../logic';
import { NOTE_KINDS, VISIBILITIES, type NoteKind, type Visibility } from '../types';
import { KIND_ICON } from './NoteBits';

const chipButton =
  'inline-flex h-[var(--control-h)] shrink-0 items-center gap-1.5 rounded-md border border-border bg-raised px-3 text-sm font-medium hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus [&_svg]:size-4 [&_svg]:text-muted';

/**
 * Capture (V433): a note in one keystroke. "/" anywhere on My day comes here; Enter files the words as a note, "/meeting"
 * or "/checklist" first makes that kind. The visibility chip starts at Only me — a note is private until shared (V454).
 * A meeting or a checklist opens straight away for its points; a note stays in the row for the next one.
 */
export function CaptureRow() {
  const t = useTranslations();
  const words = useWords();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<NoteKind>('sticky');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        input.current?.focus();
        setText((v) => (v ? v : '/'));
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const slashing = /^\/\S*$/.test(text);
  const commands = slashing ? Object.entries(SLASH).filter(([w]) => w.startsWith(text.toLowerCase())) : [];
  const parsed = parseCapture(text, kind);
  const ok = !!parsed.title && !slashing;

  const capture = async () => {
    if (!ok) return;
    setBusy(true);
    const made = parsed;
    await command(
      words(t('pages.myDay.capture.captured')),
      () =>
        door<{ id: string; request_id?: string | null }>('note_capture', {
          p_kind: made.kind,
          p_title: made.title,
          p_body: null,
          p_items: [],
          p_visibility: visibility,
          p_happened_on: today(),
          p_meeting_partner: null,
        }),
      {
        after: (r) => {
          setText('');
          setKind('sticky');
          // a meeting's points and a checklist's rows are written on the note itself
          if (made.kind !== 'sticky' && r?.id) router.push(noteRoute(r.id));
          else input.current?.focus();
        },
      },
    );
    setBusy(false);
  };

  const KindIcon = KIND_ICON[kind];
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-raised p-3" data-capture>
      <h2 className="sr-only">{t('pages.myDay.capture.label')}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <Menu>
          <MenuTrigger className={chipButton} aria-label={t('pages.myDay.capture.kind')} data-capture-kind={kind}>
            <KindIcon aria-hidden="true" />
            {t(`pages.myDay.kinds.${kind}`)}
            <ChevronDown aria-hidden="true" />
          </MenuTrigger>
          <MenuContent align="start">
            <MenuRadioGroup value={kind} onValueChange={(v) => setKind(v as NoteKind)}>
              {NOTE_KINDS.map((k) => (
                <MenuRadioItem key={k} value={k}>
                  {t(`pages.myDay.kinds.${k}`)}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuContent>
        </Menu>
        <Menu>
          <MenuTrigger
            className={chipButton}
            aria-label={t('pages.myDay.visibility.label')}
            data-capture-visibility={visibility}
          >
            {t(`pages.myDay.visibility.${visibility}`)}
            <ChevronDown aria-hidden="true" />
          </MenuTrigger>
          <MenuContent align="start">
            <MenuRadioGroup value={visibility} onValueChange={(v) => setVisibility(v as Visibility)}>
              {VISIBILITIES.map((v) => (
                <MenuRadioItem key={v} value={v}>
                  {t(`pages.myDay.visibility.${v}`)}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuContent>
        </Menu>
        <div className="flex min-w-0 flex-[1_1_16rem] gap-2">
          <Input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (commands.length === 1) {
                  setKind(SLASH[commands[0]![0]]!);
                  setText('');
                } else void capture();
              }
              if (e.key === 'Escape') setText('');
            }}
            placeholder={t('pages.myDay.capture.placeholder')}
            aria-label={t('pages.myDay.capture.label')}
            autoComplete="off"
            className="min-w-0 flex-1"
            data-capture-input
          />
          <Button variant="primary" disabled={!ok} loading={busy} onClick={() => void capture()} data-capture-save>
            {t('pages.myDay.capture.save')}
          </Button>
        </div>
      </div>
      {commands.length ? (
        <ul className="flex flex-wrap gap-2" data-capture-commands>
          {commands.map(([w, k]) => {
            const Icon = KIND_ICON[k];
            return (
              <li key={w}>
                <button
                  type="button"
                  className={chipButton}
                  onClick={() => {
                    setKind(k);
                    setText('');
                    input.current?.focus();
                  }}
                  data-capture-command={k}
                >
                  <Icon aria-hidden="true" />
                  {t(`pages.myDay.kinds.${k}`)}
                  <span className="font-data text-xs text-muted">{w}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
