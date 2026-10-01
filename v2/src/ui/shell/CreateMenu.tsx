'use client';
import { Briefcase, CheckSquare, Plus, Receipt, Trophy, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useMe } from '@/core/auth/me-context';
import { canSee } from '../person';
import { Button } from '../Button';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../Menu';

/**
 * Create actions come from the registry from P3-4; until then this list mirrors its shape. An entry shows only once
 * its screen is built (W4/W28): a raw address is never offered.
 */
export const CREATE_ACTIONS: { key: string; page: string; route: string; icon: LucideIcon; built: boolean }[] = [
  { key: 'task', page: 'tasks', route: '/tasks/new', icon: CheckSquare, built: false },
  { key: 'partner', page: 'clients', route: '/clients?new=1', icon: Briefcase, built: false },
  { key: 'invoice', page: 'finance', route: '/finance/new', icon: Receipt, built: false },
  { key: 'achievement', page: 'kpis', route: '/kpis/achievements/new', icon: Trophy, built: false },
];

/** The top bar's Create button, or on a phone the floating + above the bottom bar (V85). */
export function CreateMenu({ floating = false }: { floating?: boolean }) {
  const t = useTranslations();
  const me = useMe();
  const pathname = usePathname();
  const actions = CREATE_ACTIONS.filter((a) => a.built && canSee(me, a.page));
  // A page carries its own create control; the floating + is My day's, and only for a person who may create something.
  if (floating && (pathname !== '/my-day' || !actions.length)) return null;
  if (!actions.length) return null;
  return (
    <Menu>
      <MenuTrigger asChild>
        {floating ? (
          <button
            type="button"
            aria-label={t('top.create')}
            data-create-floating
            className="fixed bottom-[76px] end-4 z-30 inline-grid size-14 place-items-center rounded-pill bg-primary text-on-primary shadow-2 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 sm:hidden [&_svg]:size-6"
          >
            <Plus aria-hidden="true" />
          </button>
        ) : (
          <Button variant="primary" icon={<Plus />} data-create className="hidden sm:inline-flex">
            {t('top.create')}
          </Button>
        )}
      </MenuTrigger>
      <MenuContent>
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <MenuItem key={a.key} asChild>
              <Link href={a.route}>
                <Icon />
                {t(`create.${a.key}`)}
              </Link>
            </MenuItem>
          );
        })}
      </MenuContent>
    </Menu>
  );
}
