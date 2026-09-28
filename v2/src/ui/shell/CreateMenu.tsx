'use client';
import { Briefcase, CheckSquare, Plus, Receipt, Trophy, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMe } from '@/core/auth/MeProvider';
import { Button } from '../Button';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../Menu';

/** Create actions come from the registry from P3-4; until then this list mirrors its shape. */
export const CREATE_ACTIONS: { key: string; page: string; route: string; icon: LucideIcon }[] = [
  { key: 'task', page: 'tasks', route: '/tasks/new', icon: CheckSquare },
  { key: 'partner', page: 'partners', route: '/partners/new', icon: Briefcase },
  { key: 'invoice', page: 'finance', route: '/finance/new', icon: Receipt },
  { key: 'achievement', page: 'kpis', route: '/kpis/achievements/new', icon: Trophy },
];

/** The top bar's Create button, or on a phone the floating + above the bottom bar (V85). */
export function CreateMenu({ floating = false }: { floating?: boolean }) {
  const t = useTranslations();
  const me = useMe();
  const actions = CREATE_ACTIONS.filter((a) => (me.levels[a.page] ?? 'none') !== 'none');
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
