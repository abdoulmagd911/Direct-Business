import { defineModule } from '../../core/registry/define-module';

// My day (V9): the person's own page. Levels: TECH-SPEC §8.
export default defineModule({
  key: 'my_day',
  pages: [
    {
      key: 'my_day',
      route: '/my-day',
      label: 'nav.my_day',
      icon: 'sun',
      nav: { group: 'main', order: 10 },
      defaults: { admin: 'full', head: 'full', manager: 'full', member: 'own', viewer: 'view' },
    },
  ],
  // Captures and reminders (V433): each seen by its own rule alone — a private note by its author, admins included
  // (V454), a reminder by its person — so no page, no owners and no admin shortcut widen them (V183).
  entities: [
    {
      key: 'my_note',
      table: 'my.note',
      page: null,
      label: 'entity.my_note',
      owners: 'person_id',
      visible: 'my.note_visible',
      ruleOnly: true,
    },
    {
      key: 'my_note_link',
      table: 'my.note_link',
      page: null,
      label: 'entity.my_note_link',
      owners: 'created_by',
      visible: 'my.note_link_visible',
      ruleOnly: true,
    },
    {
      key: 'my_note_mention',
      table: 'my.note_mention',
      page: null,
      label: 'entity.my_note_mention',
      visible: 'my.note_mention_visible',
      ruleOnly: true,
    },
    {
      key: 'reminder',
      table: 'core.reminder',
      page: null,
      label: 'entity.reminder',
      owners: 'person_id',
      visible: 'core.reminder_visible',
      ruleOnly: true,
    },
  ],
});
