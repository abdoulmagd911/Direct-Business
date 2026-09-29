// The preview gallery's pages and people (the oversight's ask of 29 Sep 15:59: every route, every role, 1440 and 390,
// with the empty, error and no-access states). Routes follow the sidebar and the settings groups; a route that needs
// a record takes one from the run's made-up fixtures. Every person and value is made up (rule 7).
import type { Fixtures } from '../sweep/lib';

export type Persona = { key: string; label: string; note: string };

/** The roles the owner and the oversight judge the screens as; each is a made-up person of that role. */
export const PERSONAS: Persona[] = [
  { key: 'admin', label: 'Admin', note: 'an admin' },
  { key: 'admin_account', label: 'Admin account', note: "a second admin, standing in for the owner's own account" },
  { key: 'head', label: 'Head', note: 'Head of department' },
  { key: 'manager', label: 'Manager', note: 'a manager' },
  { key: 'member', label: 'Member', note: 'a member who owns two clients' },
  { key: 'viewer', label: 'Viewer', note: 'a viewer' },
  { key: 'noclients', label: 'Clients = none', note: 'a member whose Clients level is none' },
  { key: 'qa_test', label: 'Test account', note: 'an admin, standing in for the QA test account' },
];

export type Route = {
  id: string;
  group: string;
  label: string;
  path: (f: Fixtures, persona: string) => string;
  list?: boolean;
};

export const ROUTES: Route[] = [
  { id: 'my-day', group: 'Work', label: 'My day', path: () => '/my-day', list: true },
  { id: 'overview', group: 'Work', label: 'Overview', path: () => '/overview', list: true },
  { id: 'clients', group: 'Organisations', label: 'Clients', path: () => '/partners?view=clients', list: true },
  {
    id: 'suppliers',
    group: 'Organisations',
    label: 'Suppliers & partners',
    path: () => '/partners?view=suppliers',
    list: true,
  },
  {
    id: 'organisation',
    group: 'Organisations',
    label: 'An organisation (both sides)',
    path: (f) => `/partners/${f.orgs.beta.id}`,
  },
  { id: 'pipeline', group: 'Work', label: 'Pipeline', path: () => '/pipeline', list: true },
  { id: 'projects', group: 'Work', label: 'Projects', path: () => '/projects', list: true },
  { id: 'tasks', group: 'Work', label: 'Tasks', path: () => '/tasks', list: true },
  { id: 'finance', group: 'Money and results', label: 'Finance', path: () => '/finance', list: true },
  { id: 'kpis', group: 'Money and results', label: 'KPIs', path: () => '/kpis', list: true },
  { id: 'reports', group: 'Money and results', label: 'Reports', path: () => '/reports', list: true },
  { id: 'appraisal', group: 'People', label: 'Appraisal', path: () => '/appraisal' },
  { id: 'activity', group: 'Activity', label: 'Activity', path: () => '/activity', list: true },
  {
    id: 'activity-settings',
    group: 'Activity',
    label: 'Activity · Settings log',
    path: () => '/activity?tab=settings',
  },
  { id: 'activity-signins', group: 'Activity', label: 'Activity · Sign-ins', path: () => '/activity?tab=signIns' },
  { id: 'profile', group: 'People', label: 'My profile', path: () => '/profile' },
  { id: 'person', group: 'People', label: "A colleague's record", path: (f) => `/people/${f.users.member2!.id}` },
  {
    id: 'own-record',
    group: 'People',
    label: 'Their own record',
    path: (f, persona) => `/people/${(f.users[persona] ?? f.users.admin!).id}`,
  },
  { id: 'settings-people', group: 'Settings', label: 'Organization & access · People', path: () => '/settings/org' },
  {
    id: 'settings-access',
    group: 'Settings',
    label: 'Organization & access · Access',
    path: () => '/settings/org?tab=access',
  },
  {
    id: 'settings-roles',
    group: 'Settings',
    label: 'Organization & access · Roles',
    path: () => '/settings/org?tab=roles',
  },
  {
    id: 'settings-teams',
    group: 'Settings',
    label: 'Organization & access · Teams',
    path: () => '/settings/org?tab=teams',
  },
  {
    id: 'settings-org-settings',
    group: 'Settings',
    label: 'Organization & access · Settings',
    path: () => '/settings/org?tab=settings',
  },
  { id: 'settings-app', group: 'Settings', label: 'App settings', path: () => '/settings/app' },
  { id: 'settings-finance', group: 'Settings', label: 'Finance settings', path: () => '/settings/finance' },
  { id: 'settings-partners', group: 'Settings', label: 'Organisation settings', path: () => '/settings/partners' },
  { id: 'settings-performance', group: 'Settings', label: 'Performance settings', path: () => '/settings/performance' },
  { id: 'settings-work', group: 'Settings', label: 'Work settings', path: () => '/settings/work' },
  { id: 'not-found', group: 'Other', label: 'An address that does not exist', path: () => '/no/such/address' },
];
