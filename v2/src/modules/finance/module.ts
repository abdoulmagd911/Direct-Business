import { defineModule } from '../../core/registry/define-module';

// Finance — Own is entering invoices and editing your own entries (owner decision 4). Levels: TECH-SPEC §8.
export default defineModule({
  key: 'finance',
  pages: [
    {
      key: 'finance',
      route: '/finance',
      label: 'nav.finance',
      icon: 'wallet',
      nav: { group: 'main', order: 70, tier: 'manage' },
      defaults: { admin: 'full', head: 'full', manager: 'full', member: 'own', viewer: 'view' },
    },
    {
      key: 'settings.finance',
      route: '/settings/finance',
      label: 'nav.settings.finance',
      nav: { group: 'settings', order: 50 },
      levels: ['none', 'full'],
      defaults: { admin: 'full' },
    },
  ],
  capabilities: [
    { key: 'finance.import', page: 'finance', label: 'cap.finance.import', defaults: { head: true } },
    { key: 'finance.credit', page: 'finance', label: 'cap.finance.credit', defaults: { head: true, manager: true } },
  ],
});
