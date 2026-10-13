import { z } from 'zod';
import { defineModule } from '../../core/registry/define-module';

// Settings → Organization & access: people, their allowed emails, teams, roles, the access matrix (P3-5), and signing
// a person out (V74). Levels: TECH-SPEC §8.
export default defineModule({
  key: 'org',
  pages: [
    {
      key: 'settings.org',
      route: '/settings/org',
      label: 'nav.settings.org',
      nav: { group: 'settings', order: 20 },
      levels: ['none', 'full'],
      defaults: { admin: 'full' },
    },
  ],
  capabilities: [{ key: 'org.sign_out', page: 'settings.org', label: 'cap.org.sign_out', defaults: {} }],
  entities: [
    {
      key: 'department',
      table: 'core.department',
      page: 'settings.org',
      label: 'entity.department',
      owners: 'head_person_id',
    },
    { key: 'team', table: 'core.team', page: 'settings.org', label: 'entity.team', owners: 'lead_person_id' },
    { key: 'role', table: 'core.role', page: 'settings.org', label: 'entity.role' },
    { key: 'person', table: 'core.person', page: 'settings.org', label: 'entity.person', owners: 'id' },
    {
      key: 'person_team',
      table: 'core.person_team_assist',
      page: 'settings.org',
      label: 'entity.person_team',
      owners: 'person_id',
    },
    {
      key: 'person_department',
      table: 'core.person_department',
      page: 'settings.org',
      label: 'entity.person_department',
      owners: 'person_id',
    },
    {
      key: 'person_email',
      table: 'core.person_email',
      page: 'settings.org',
      label: 'entity.person_email',
      owners: 'person_id',
    },
    {
      key: 'person_auth',
      table: 'core.person_auth',
      page: 'settings.org',
      label: 'entity.person_auth',
      owners: 'person_id',
    },
    {
      key: 'person_level',
      table: 'core.person_page_level',
      page: 'settings.org',
      label: 'entity.person_level',
      owners: 'person_id',
    },
    {
      key: 'person_capability',
      table: 'core.person_capability',
      page: 'settings.org',
      label: 'entity.person_capability',
      owners: 'person_id',
    },
    { key: 'role_level', table: 'core.role_page_level', page: 'settings.org', label: 'entity.role_level' },
    // V510: a team's level on a page, between the role's default and the person's override.
    { key: 'team_level', table: 'core.team_page_level', page: 'settings.org', label: 'entity.team_level' },
    { key: 'role_capability', table: 'core.role_capability', page: 'settings.org', label: 'entity.role_capability' },
    { key: 'page', table: 'core.page', page: 'settings.org', label: 'entity.page' },
    { key: 'capability', table: 'core.capability', page: 'settings.org', label: 'entity.capability' },
    { key: 'entity', table: 'core.entity', page: 'settings.org', label: 'entity.entity' },
  ],
  settings: [
    {
      key: 'auth.device_idle_days',
      group: 'settings.org',
      label: 'setting.auth.device_idle_days',
      schema: z.number().int().min(1).max(365),
      default: 30,
    },
    {
      // People sign in with their e-mail and a password (V166); the emailed 6-digit code stays built, off unless an
      // admin switches it on.
      key: 'auth.code_door_enabled',
      group: 'settings.org',
      label: 'setting.auth.code_door_enabled',
      schema: z.boolean(),
      default: false,
    },
  ],
});
