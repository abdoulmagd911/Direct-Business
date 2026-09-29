import { defineModule } from '../../core/registry/define-module';

// Partners — clients, suppliers, strategic partners (V52); helpers, not locks (D7, V26). Levels: TECH-SPEC §8.
export default defineModule({
  key: 'partners',
  pages: [
    {
      key: 'partners',
      route: '/partners',
      label: 'nav.partners',
      icon: 'building-2',
      nav: { group: 'main', order: 30 },
      defaults: { admin: 'full', head: 'full', manager: 'full', member: 'full', viewer: 'view' },
    },
    {
      key: 'settings.partners',
      route: '/settings/partners',
      label: 'nav.settings.partners',
      nav: { group: 'settings', order: 30 },
      defaults: { admin: 'full', head: 'full', manager: 'view' },
    },
  ],
  capabilities: [
    {
      key: 'partners.identify',
      page: 'partners',
      label: 'cap.partners.identify',
      defaults: { head: true, manager: true },
    },
    { key: 'partners.merge', page: 'partners', label: 'cap.partners.merge', defaults: { head: true } },
    { key: 'partners.assign', page: 'partners', label: 'cap.partners.assign', defaults: { head: true, manager: true } },
    {
      key: 'finance.credit_control',
      page: 'partners',
      label: 'cap.finance.credit_control',
      defaults: { head: true },
    },
  ],
});
