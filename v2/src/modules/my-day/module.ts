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
});
