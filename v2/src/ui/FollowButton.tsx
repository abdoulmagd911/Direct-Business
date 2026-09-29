'use client';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { rpc } from '@/core/db/rpc';
import { errorKey } from '@/core/db/words';
import { Button } from './Button';
import { toast } from './Toast';

/**
 * Follow / Following on any record (V61, §3.3): a follower is told of every change to it by someone else
 * (`followed_change`). Reads api.following on mount; one click flips it through api.follow. Not a logged request, so
 * no Undo: the button itself goes back.
 */
export function FollowButton({ entity, id, size = 'md' }: { entity: string; id: string; size?: 'sm' | 'md' }) {
  const t = useTranslations();
  // null: still reading; 'hidden': the record's own rule refuses this person (authz.can_see) or the record is gone,
  // so no button; 'failed': the read did not answer (the network, the server) — said, with Try again (QA-74).
  const [on, setOn] = useState<boolean | null | 'hidden' | 'failed'>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    rpc('following', { p_entity: entity, p_id: id })
      .then((v) => live && setOn(v === true))
      .catch((e: unknown) => {
        if (!live) return;
        const kind = (e as { kind?: string }).kind;
        setOn(kind === 'PermissionDenied' || kind === 'NotFound' ? 'hidden' : 'failed');
      });
    return () => {
      live = false;
    };
  }, [entity, id, attempt]);
  if (on === 'hidden') return null;
  if (on === 'failed')
    return (
      <Button size={size} variant="ghost" onClick={() => setAttempt((a) => a + 1)} data-follow-failed>
        {t('follow.failed')}
      </Button>
    );
  const flip = async () => {
    if (on === null) return;
    setBusy(true);
    try {
      const next = await rpc('follow', { p_entity: entity, p_id: id, p_on: !on });
      setOn(next === true);
      toast.done(next ? t('follow.following') : t('follow.unfollowed'));
    } catch (e) {
      const { key, detail } = errorKey(e, (k) => t.has(k));
      toast.failed(t(key, { detail }));
    }
    setBusy(false);
  };
  return (
    <Button
      size={size}
      icon={on ? <EyeOff /> : <Eye />}
      onClick={() => void flip()}
      disabled={on === null}
      loading={busy}
      aria-pressed={on === true}
      data-follow
      data-following={on ? '' : undefined}
    >
      {on ? t('follow.following') : t('follow.follow')}
    </Button>
  );
}
