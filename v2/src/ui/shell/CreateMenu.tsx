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

export function CreateMenu() {
  const t = useTranslations();
  const me = useMe();
  const actions = CREATE_ACTIONS.filter((a) => (me.levels[a.page] ?? 'none') !== 'none');
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="primary" icon={<Plus />} data-create>
          <span className="hidden sm:inline">{t('top.create')}</span>
          <span className="sr-only sm:hidden">{t('top.create')}</span>
        </Button>
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
