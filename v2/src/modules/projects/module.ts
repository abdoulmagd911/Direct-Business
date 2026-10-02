import { defineModule } from '../../core/registry/define-module';

// Projects. Levels: TECH-SPEC §8.
export default defineModule({
  key: 'projects',
  pages: [
    {
      key: 'projects',
      route: '/projects',
      label: 'nav.projects',
      icon: 'folder-kanban',
      nav: { group: 'main', order: 60, tier: 'manage' },
      defaults: { admin: 'full', head: 'full', manager: 'full', member: 'own', viewer: 'view' },
    },
  ],
});
