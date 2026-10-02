import { defineModule } from '../../core/registry/define-module';

// The Commercial overview for the department's leaders (V80). Levels: TECH-SPEC §8.
export default defineModule({
  key: 'overview',
  pages: [
    {
      key: 'overview',
      route: '/overview',
      label: 'nav.overview',
      icon: 'layout-dashboard',
      nav: { group: 'main', order: 50, tier: 'manage', from: 'head' },
      defaults: { admin: 'full', head: 'full', manager: 'view', viewer: 'view' },
    },
  ],
});
