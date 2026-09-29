import { defineModule } from '../../core/registry/define-module';

// KPIs, with achievements and challenges; and the Plan & performance settings. Levels: TECH-SPEC §8.
export default defineModule({
  key: 'perf',
  pages: [
    {
      key: 'kpis',
      route: '/kpis',
      label: 'nav.kpis',
      icon: 'target',
      nav: { group: 'main', order: 80 },
      defaults: { admin: 'full', head: 'full', manager: 'full', member: 'own', viewer: 'view' },
    },
    {
      key: 'settings.performance',
      route: '/settings/performance',
      label: 'nav.settings.performance',
      nav: { group: 'settings', order: 40 },
      defaults: { admin: 'full', head: 'full', manager: 'view', member: 'view', viewer: 'view' },
    },
  ],
});
