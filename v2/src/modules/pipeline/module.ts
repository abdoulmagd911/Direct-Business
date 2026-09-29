import { defineModule } from '../../core/registry/define-module';

// Pipeline — tenders and partnership opportunities (V80). Levels: TECH-SPEC §8.
export default defineModule({
  key: 'pipeline',
  pages: [
    {
      key: 'pipeline',
      route: '/pipeline',
      label: 'nav.pipeline',
      icon: 'git-branch',
      nav: { group: 'main', order: 40 },
      defaults: { admin: 'full', head: 'full', manager: 'full', member: 'own', viewer: 'view' },
    },
  ],
});
