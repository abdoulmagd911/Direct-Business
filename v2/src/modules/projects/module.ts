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
  // Seen by the whole team of its department (V96), changed by its owner with Own or anyone with Full (§5).
  entities: [
    {
      key: 'project',
      table: 'work.project',
      page: 'projects',
      label: 'entity.project',
      owners: 'owner_id',
      level: 'work.row_level',
    },
    {
      key: 'project_health',
      table: 'work.project_health',
      page: 'projects',
      label: 'entity.project_health',
      owners: 'work.project_health_owners',
      level: 'work.row_level',
      history: true,
    },
  ],
});
