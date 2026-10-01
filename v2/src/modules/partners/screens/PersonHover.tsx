'use client';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { rpc } from '@/core/db/rpc';
import { Avatar, type AvatarColor, type BadgeKind } from '@/ui/Avatar';
import { HoverCard } from '@/ui/HoverCard';

type HoverPerson = {
  id: string;
  full_name_en: string;
  full_name_ar: string | null;
  display_name_en: string;
  display_name_ar: string | null;
  job_title_en: string | null;
  job_title_ar: string | null;
  department_en: string | null;
  department_ar: string | null;
  team_en: string | null;
  team_ar: string | null;
  avatar_color: AvatarColor | null;
  badge_kind: BadgeKind | null;
  badge_value: string | null;
  active: boolean;
};

/** The person hover card (V61): name, job title, department · team — from api.hover_person, read once when it opens. */
export function PersonHover({ id, children }: { id: string; children: ReactNode }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const pick = (en: string | null, ar: string | null) => (locale === 'ar' && ar ? ar : en) ?? '';
  return (
    <HoverCard<HoverPerson | null>
      load={async () => (await rpc('hover_person', { p_id: id })) as unknown as HoverPerson | null}
      render={(p, state) =>
        state === 'failed' || (state === 'ready' && !p) ? (
          <span className="text-muted">{t('state.failed', { what: t('entity.person') })}</span>
        ) : !p ? (
          <span className="text-muted">{t('common.loading')}</span>
        ) : (
          <div className="flex items-center gap-3" data-person-hover={p.id}>
            <Avatar
              person={{
                displayName: pick(p.display_name_en, p.display_name_ar),
                fullName: pick(p.full_name_en, p.full_name_ar),
                avatarColor: p.avatar_color ?? 'c1',
                badge: p.badge_kind ? { kind: p.badge_kind, value: p.badge_value } : undefined,
              }}
              size="lg"
            />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-semibold">{pick(p.full_name_en, p.full_name_ar)}</span>
              <span className="truncate text-muted">
                {[
                  pick(p.job_title_en, p.job_title_ar),
                  [pick(p.department_en, p.department_ar), pick(p.team_en, p.team_ar)].filter(Boolean).join(' · '),
                ]
                  .filter(Boolean)
                  .join(' — ')}
              </span>
            </span>
          </div>
        )
      }
    >
      {children}
    </HoverCard>
  );
}
