import { z } from 'zod';
import { defineModule } from '../../core/registry/define-module';

// Organisations — Clients, and Suppliers & partners: one record, two sides (V98); helpers, not locks (D7, V26).
// Levels: TECH-SPEC §8.
export default defineModule({
  key: 'partners',
  pages: [
    // One organisation record, two sides (V98): each side's list is its own page, with its own access and capabilities.
    // The routes are builder B's list screen for now (/partners?view=…); record pages stay /partners/[id].
    {
      key: 'clients',
      route: '/partners?view=clients',
      label: 'nav.clients',
      icon: 'building-2',
      nav: { group: 'main', order: 30 },
      defaults: { admin: 'full', head: 'full', manager: 'full', member: 'full', viewer: 'view' },
    },
    {
      key: 'suppliers_partners',
      route: '/partners?view=suppliers',
      label: 'nav.suppliers_partners',
      icon: 'handshake',
      nav: { group: 'main', order: 31 },
      defaults: { admin: 'full', head: 'full', manager: 'full', member: 'full', viewer: 'view' },
    },
    {
      key: 'settings.partners',
      route: '/settings/partners',
      label: 'nav.settings.partners',
      nav: { group: 'settings', order: 30 },
      levels: ['none', 'full'],
      defaults: { admin: 'full' },
    },
  ],
  entities: [
    // An organisation's records go by the pages of its sides (partner.row_level — V98): the whole record by the sides
    // it has on, a side's own rows (and client IDs, codes, credit) by that side's page.
    ...(
      [
        ['partner', 'partner.partner', 'partner.partner_owners'],
        ['partner_side', 'partner.partner_side', 'partner.partner_side_owners'],
        ['side_status', 'partner.side_status_change', 'partner.side_status_change_owners'],
        ['side_owner', 'partner.side_owner', 'partner.side_owner_owners'],
        ['credit_limit', 'partner.credit_limit', 'partner.credit_limit_owners'],
        ['identifier', 'partner.identifier', 'partner.identifier_owners'],
        ['contact', 'partner.contact', 'partner.contact_owners'],
        ['partner_merge', 'partner.merge', undefined],
      ] as const
    ).map(([key, table, owners]) => ({
      key,
      table,
      page: 'clients',
      label: `entity.${key}`,
      ...(owners ? { owners } : {}),
      level: 'partner.row_level',
    })),
    // Client-side matters with no organisation of their own (V65, D25).
    { key: 'code_terms', table: 'partner.code_terms', page: 'clients', label: 'entity.code_terms' },
    {
      key: 'campaign_code',
      table: 'partner.campaign_code',
      page: 'clients',
      label: 'entity.campaign_code',
      owners: 'owner_id',
    },
    { key: 'individual_name', table: 'partner.individual_name', page: 'clients', label: 'entity.individual_name' },
    {
      key: 'identifier_block',
      table: 'partner.identifier_block',
      page: 'settings.partners',
      label: 'entity.identifier_block',
    },
    { key: 'side_field', table: 'partner.side_field', page: 'settings.partners', label: 'entity.side_field' },
    ...(
      [
        ['side_type', 'partner.side_type'],
        ['side_tier', 'partner.side_tier'],
        ['side_status_reason', 'partner.side_status_reason'],
        ['contact_role', 'partner.contact_role'],
        ['call_outcome', 'partner.call_outcome'],
        ['contract_term', 'partner.term'],
      ] as const
    ).map(([key, table]) => ({ key, table, page: 'settings.partners', label: `entity.${key}`, list: true })),
  ],
  settings: [
    {
      key: 'partner.id_format',
      group: 'settings.partners',
      label: 'setting.partner.id_format',
      schema: z
        .object({ prefix: z.string().regex(/^[A-Z][A-Z0-9-]*$/), width: z.number().int().min(3).max(8) })
        .strict(),
      default: { prefix: 'DK-P', width: 4 },
    },
    {
      key: 'partner.name_stop_words',
      group: 'settings.partners',
      label: 'setting.partner.name_stop_words',
      schema: z.array(z.string().min(1)),
      default: ['شركة', 'مؤسسة', 'company', 'co', 'corp', 'corporation', 'ltd', 'limited', 'llc', 'inc', 'est'],
    },
    {
      key: 'partner.one_code_per_partner',
      group: 'settings.partners',
      label: 'setting.partner.one_code_per_partner',
      schema: z.boolean(),
      default: true,
    },
  ],
  capabilities: [
    // Per side (V98): the same three powers on the Client side and on the Supplier & partner side.
    ...(['clients', 'suppliers_partners'] as const).flatMap((page) => [
      {
        key: `${page}.identify`,
        page,
        label: `cap.${page}.identify`,
        defaults: { head: true, manager: true },
      },
      { key: `${page}.merge`, page, label: `cap.${page}.merge`, defaults: { head: true } },
      { key: `${page}.assign`, page, label: `cap.${page}.assign`, defaults: { head: true, manager: true } },
    ]),
    {
      key: 'finance.credit_control',
      page: 'clients',
      label: 'cap.finance.credit_control',
      defaults: { head: true },
    },
  ],
});
