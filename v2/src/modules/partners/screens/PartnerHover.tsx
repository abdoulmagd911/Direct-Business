'use client';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { rpc } from '@/core/db/rpc';
import { StatusChip } from '@/ui/Chip';
import { HoverCard } from '@/ui/HoverCard';
import { PartnerLogo } from '@/ui/PartnerLogo';
import { statusTone, tradeName, type HoverPartner } from '../types';

/**
 * The organisation hover card (V61, V149): name, number, the sides as chips with type and status, the key-partner mark
 * — from api.hover_partner, read once when the card first opens. The header figures join it with the record page's
 * setting (V95) once P3-9b draws them here too.
 */
export function PartnerHover({ id, children }: { id: string; children: ReactNode }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  return (
    <HoverCard<HoverPartner | null>
      load={async () => (await rpc('hover_partner', { p_id: id })) as unknown as HoverPartner | null}
      render={(p, state) =>
        state === 'failed' || (state === 'ready' && !p) ? (
          <span className="text-muted">{t('state.failed', { what: t('entity.partner') })}</span>
        ) : !p ? (
          <span className="text-muted">{t('common.loading')}</span>
        ) : (
          <div className="flex flex-col gap-2" data-partner-hover={p.id}>
            <div className="flex items-center gap-2.5">
              <PartnerLogo name={p.trade_name_en} size="md" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{tradeName(p, locale)}</span>
                <span className="font-data text-xs text-muted">{p.number}</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {p.sides.map((s) => (
                <StatusChip key={s.side} tone={statusTone(s.status)}>
                  {t(`partners.side.${s.side}`)} · {s.type}
                  {s.status ? ` · ${t(`partners.status.${s.status}`)}` : ''}
                </StatusChip>
              ))}
              {p.key_partner ? <StatusChip tone="info">{t('partners.keyPartner')}</StatusChip> : null}
            </div>
          </div>
        )
      }
    >
      {children}
    </HoverCard>
  );
}
