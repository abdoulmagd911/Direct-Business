import { defineModule } from '../../core/registry/define-module';

// Reports — named report editors edit drafts whatever their level (V57, V79). Levels: TECH-SPEC §8.
export default defineModule({
  key: 'reports',
  pages: [
    {
      key: 'reports',
      route: '/reports',
      label: 'nav.reports',
      icon: 'file-text',
      nav: { group: 'main', order: 90 },
      defaults: { admin: 'full', head: 'full', manager: 'view', member: 'view', viewer: 'view' },
    },
  ],
});
