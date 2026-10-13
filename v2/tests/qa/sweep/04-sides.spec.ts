/**
 * The two sides of one organisation (V98, V146–V149, V152, V153): a person shut out of Clients (Clients = none) may
 * work an organisation's Supplier & partner side, but must neither see nor change its Client side — status, owner,
 * client IDs and codes, contracts, files, history, notices — through any door: the card, the hover card, Ctrl K's
 * search, the lists, Activity, the bell, or the Data API with their own session. Two such people: a member (no Clients
 * capabilities) and a manager who keeps their role's clients.assign and clients.identify (the oversight's finding:
 * side writes were gated by capability only). The organisation screens are P3-9: their UI lines are NOT BUILT.
 */
import { test } from '@playwright/test';
import { apiAs, fx, info, inWords, notBuilt, said, sql, user, verdict, type Answer } from './lib';

const AREA = 'sides';
const SHUT_OUT = ['noclients', 'noclientscap'] as const;

async function fingerprint(partner: string): Promise<string> {
  const [row] = await sql(
    `select partner.status_of($1, 'client') as status,
       (select string_agg(x::text, ',' order by x) from partner.side_owners($1, 'client') x) as owners,
       (select string_agg(i.kind || ':' || i.value_raw, ',' order by i.kind, i.value_raw) from partner.identifier i
         where i.partner_id = $1 and i.deleted_at is null) as ids,
       (select string_agg(c.title || '#' || c.version, ',' order by c.title) from partner.contract c
         where c.partner_id = $1 and c.deleted_at is null) as contracts,
       (select count(*) from partner.credit_limit c where c.partner_id = $1 and c.deleted_at is null)::text as credit,
       (select s.type_id::text || '/' || coalesce(s.until::text, '') from partner.partner_side s
         where s.partner_id = $1 and s.side = 'client' and s.deleted_at is null) as side`,
    [partner],
  );
  return JSON.stringify(row);
}

// In order, in one worker (the notices test changes Beta's status and undoes it; the writes test compares before and
// after): 'default' keeps the order without skipping the rest when one test fails.
test.describe.configure({ mode: 'default' });

test('reads: the Client side of a two-sided organisation stays out of sight', async () => {
  const f = fx();
  const beta = f.orgs.beta;
  const clientOwner = user('member').id;
  const [ids] = await sql<{ side: string; status: string }>(
    `select (select id::text from partner.partner_side where partner_id = $1 and side = 'client' and deleted_at is null) as side,
            (select id::text from partner.side_status_change where partner_id = $1 and side = 'client' and deleted_at is null
              order by created_at desc limit 1) as status`,
    [beta.id],
  );
  for (const key of SHUT_OUT) {
    const api = await apiAs(key);
    const base = { area: AREA, user: key };

    const card = await api('partner', { p_id: beta.id });
    const text = JSON.stringify(card.data ?? {});
    const c = (card.data ?? {}) as {
      sides?: { side: string }[];
      owner_id?: string;
      credit_limits?: unknown;
      counts?: { contracts?: number };
    };
    verdict(
      {
        ...base,
        screen: '(api) partner [beta]',
        check: 'the card opens (the Supplier & partner side is theirs)',
        detail: card.ok ? 'answered' : said(card),
      },
      card.ok,
    );
    verdict(
      {
        ...base,
        screen: '(api) partner [beta]',
        check: 'the card carries no Client side (no status, no owner, no history)',
        detail: `sides: ${(c.sides ?? []).map((s) => s.side).join(', ')}`,
      },
      !(c.sides ?? []).some((s) => s.side === 'client'),
    );
    verdict(
      {
        ...base,
        screen: '(api) partner [beta]',
        check: 'the card carries no client ID',
        detail: text.includes(f.identifiers.betaClientId.value) ? 'client ID present' : 'absent',
      },
      !text.includes(f.identifiers.betaClientId.value),
    );
    verdict(
      {
        ...base,
        screen: '(api) partner [beta]',
        check: "the card's owner_id is not the Client side's account manager",
        detail: `owner_id ${c.owner_id === clientOwner ? '= the Client side owner (Test Member)' : 'is another owner'}${beta.clientOwnerFirst ? '' : ' · (owner order did not put the client owner first; weak check)'}`,
      },
      c.owner_id !== clientOwner,
    );
    verdict(
      {
        ...base,
        screen: '(api) partner [beta]',
        check: 'the Client contract is not counted',
        detail: `counts.contracts ${c.counts?.contracts}`,
      },
      c.counts?.contracts === 1,
    );
    verdict(
      {
        ...base,
        screen: '(api) partner [beta]',
        check: 'no credit limits',
        detail: JSON.stringify(c.credit_limits ?? null),
      },
      c.credit_limits === null || c.credit_limits === undefined,
    );
    const clientSince = (card.data as { client_since?: unknown } | null)?.client_since;
    info({
      ...base,
      screen: '(api) partner [beta]',
      check: "the card still carries the organisation's client_since field",
      detail: `client_since: ${JSON.stringify(clientSince ?? null)}`,
    });

    const hover = await api('hover_partner', { p_id: beta.id });
    const h = (hover.data ?? {}) as { sides?: { side: string }[]; owner_id?: string };
    verdict(
      {
        ...base,
        screen: '(api) hover_partner [beta]',
        check: 'the hover card shows no Client chip',
        detail: said(hover),
      },
      hover.ok && !(h.sides ?? []).some((s) => s.side === 'client'),
    );
    verdict(
      {
        ...base,
        screen: '(api) hover_partner [beta]',
        check: "the hover card's owner is not the Client side's account manager",
        detail: h.owner_id === clientOwner ? 'owner_id = the Client side owner' : 'another owner',
      },
      h.owner_id !== clientOwner,
    );

    const alpha = await api('partner', { p_id: f.orgs.alpha.id });
    verdict(
      {
        ...base,
        screen: '(api) partner [alpha]',
        check: 'a Client-only organisation is refused, in words',
        detail: said(alpha),
      },
      !alpha.ok && inWords(alpha),
    );
    const alphaHover = await api('hover_partner', { p_id: f.orgs.alpha.id });
    verdict(
      {
        ...base,
        screen: '(api) hover_partner [alpha]',
        check: 'no hover card for a Client-only organisation',
        detail: said(alphaHover),
      },
      !alphaHover.ok || alphaHover.data === null,
    );

    const byId = await api('search', { p_q: f.identifiers.betaClientId.value });
    const byName = await api('search', { p_q: f.orgs.alpha.name });
    const hits = (a: Answer) => ((a.data as { partners?: unknown[] } | null)?.partners ?? []).length;
    verdict(
      { ...base, screen: '(api) search (Ctrl K)', check: 'a client ID finds nothing', detail: `${hits(byId)} hits` },
      byId.ok && hits(byId) === 0,
    );
    verdict(
      {
        ...base,
        screen: '(api) search (Ctrl K)',
        check: 'a Client-only organisation is not found by name',
        detail: `${hits(byName)} hits`,
      },
      byName.ok && hits(byName) === 0,
    );

    const clients = await api('partners', { p_filters: { side: 'client' } });
    verdict(
      {
        ...base,
        screen: '(api) partners side=client',
        check: 'the Clients list is refused, in words',
        detail: said(clients),
      },
      !clients.ok && inWords(clients),
    );
    const all = await api('partners', { p_filters: {} });
    const rows =
      (all.data as { rows?: { id: string; sides?: { side: string }[]; status?: unknown; owner_id?: unknown }[] } | null)
        ?.rows ?? [];
    const alphaRow = rows.some((r) => r.id === f.orgs.alpha.id);
    const betaRow = rows.find((r) => r.id === beta.id);
    verdict(
      {
        ...base,
        screen: '(api) partners',
        check: 'the list without a side leaves out the Client-only organisation',
        detail: alphaRow ? 'Alpha listed' : 'absent',
      },
      all.ok && !alphaRow,
    );
    verdict(
      {
        ...base,
        screen: '(api) partners',
        check: "Beta's row shows no Client side",
        detail: JSON.stringify(betaRow?.sides?.map((s) => s.side) ?? null),
      },
      !!betaRow && !(betaRow.sides ?? []).some((s) => s.side === 'client'),
    );

    const contracts = await api('contracts', { p_partner: beta.id });
    const ctext = JSON.stringify(contracts.data ?? '');
    verdict(
      {
        ...base,
        screen: '(api) contracts [beta]',
        check: 'only the Supplier & partner contract is listed',
        detail: `${ctext.includes(f.contracts.betaClient) ? 'CLIENT CONTRACT LISTED' : 'client contract absent'} · ${ctext.includes(f.contracts.betaSupplier) ? 'supplier listed' : 'supplier absent'}`,
      },
      contracts.ok && !ctext.includes(f.contracts.betaClient) && ctext.includes(f.contracts.betaSupplier),
    );
    const clientContracts = await api('contracts', { p_partner: beta.id, p_side: 'client' });
    verdict(
      {
        ...base,
        screen: '(api) contracts [beta] side=client',
        check: 'asking for the Client side by name gives nothing',
        detail: said(clientContracts),
      },
      !clientContracts.ok || !JSON.stringify(clientContracts.data).includes(f.contracts.betaClient),
    );

    const files = await api('files', { p_entity: 'partner', p_id: beta.id, p_side: 'client' });
    verdict(
      {
        ...base,
        screen: '(api) files [beta] side=client',
        check: "the Client side's files are refused or empty",
        detail: said(files),
      },
      !files.ok || JSON.stringify(files.data) === '[]',
    );

    for (const [entity, id] of [
      ['partner_side', ids?.side],
      ['side_status', ids?.status],
      ['identifier', f.identifiers.betaClientId.id],
      ['contract', f.contracts.betaClient],
    ] as const) {
      const history = await api('record_history', { p_entity: entity, p_id: id });
      verdict(
        {
          ...base,
          screen: `(api) record_history ${entity}`,
          check: "the Client side's history is refused, in words",
          detail: said(history),
        },
        !history.ok && inWords(history),
      );
      const see = await api('can_see', { p_entity: entity, p_id: id });
      verdict(
        { ...base, screen: `(api) can_see ${entity}`, check: 'can_see says no', detail: said(see) },
        see.ok && see.data === false,
      );
    }
  }
});

test('notices and Activity: a follower shut out of Clients is not told of Client-side changes', async () => {
  const f = fx();
  const admin = await apiAs('admin');
  const followed: Record<string, Answer> = {};
  for (const key of SHUT_OUT)
    followed[key] = await (await apiAs(key))('follow', { p_entity: 'partner', p_id: f.orgs.beta.id, p_on: true });
  const change = await admin('partner_status_set', {
    p_id: f.orgs.beta.id,
    p_side: 'client',
    p_status: 'prospect',
    p_note: `QA sweep ${f.tag}`,
  });
  const request = (change.data as { request_id?: string } | null)?.request_id ?? '';
  const supplierChange = await admin('partner_status_set', {
    p_id: f.orgs.beta.id,
    p_side: 'supplier_partner',
    p_status: 'prospect',
    p_note: `QA sweep ${f.tag}`,
  });
  const supplierRequest = (supplierChange.data as { request_id?: string } | null)?.request_id ?? '';
  for (const key of SHUT_OUT) {
    const base = { area: AREA, user: key };
    info({
      ...base,
      screen: '(api) follow [beta]',
      check: 'follows the two-sided organisation',
      detail: said(followed[key]!),
    });
    const rows = await sql<{ request_id: string | null; kind: string }>(
      `select request_id::text, kind from notify.notification where person_id = $1 and request_id = any ($2::uuid[])`,
      [user(key).id, [request, supplierRequest].filter(Boolean)],
    );
    const told = rows.filter((r) => r.request_id === request).length;
    verdict(
      {
        ...base,
        screen: '(bell) notify.notification',
        check: "no notice of the Client side's status change",
        detail: `${told} notices`,
      },
      told === 0,
    );
    info({
      ...base,
      screen: '(bell) notify.notification',
      check: "a notice of the Supplier & partner side's change (they follow it)",
      detail: `${rows.filter((r) => r.request_id === supplierRequest).length} notices`,
    });
    const bell = await (await apiAs(key))('notifications', { p_tab: 'all' });
    verdict(
      {
        ...base,
        screen: '(api) notifications',
        check: 'the bell carries nothing from the Client side',
        detail: JSON.stringify(bell.data ?? '').includes(request) ? 'client request present' : said(bell).slice(0, 100),
      },
      bell.ok && !JSON.stringify(bell.data ?? '').includes(request),
    );
  }
  // Activity (the manager has Activity · View; the member none)
  const act = await (await apiAs('noclientscap'))('activity', { p_limit: 200 });
  const text = JSON.stringify(act.data ?? '');
  verdict(
    {
      area: AREA,
      user: 'noclientscap',
      screen: '(api) activity',
      check: "Activity leaves out the Client side's changes",
      detail: `${text.includes(request) ? 'client status change listed' : 'absent'} · ${text.includes(f.identifiers.betaClientId.value) ? 'client ID in a row' : 'no client ID'}`,
    },
    act.ok && !text.includes(request) && !text.includes(f.identifiers.betaClientId.value),
  );
  await admin('undo', { p_request: request });
  await admin('undo', { p_request: supplierRequest });
});

test('writes: a person shut out of Clients cannot change the Client side, whatever capabilities they keep', async () => {
  const f = fx();
  const beta = f.orgs.beta.id;
  const alpha = f.orgs.alpha.id;
  const admin = await apiAs('admin');
  const attempts: { name: string; fn: string; args: (me: string) => Record<string, unknown> }[] = [
    {
      name: 'set the Client status',
      fn: 'partner_status_set',
      args: () => ({ p_id: beta, p_side: 'client', p_status: 'prospect', p_note: 'QA sweep' }),
    },
    {
      name: 'set the Client owner',
      fn: 'partner_owner_set',
      args: (me) => ({ p_id: beta, p_side: 'client', p_person: me, p_reason: 'QA sweep' }),
    },
    {
      name: 'add a client ID',
      fn: 'identifier_add',
      args: () => ({
        p_partner: beta,
        p_kind: 'payments_client_id',
        p_value: `8${String(parseInt(f.tag, 36) % 1e8).padStart(8, '0')}`,
        p_reason: 'QA sweep',
      }),
    },
    {
      name: 'add a discount code',
      fn: 'identifier_add',
      args: () => ({
        p_partner: beta,
        p_kind: 'discount_code',
        p_value: `QACODE${f.tag.toUpperCase()}`,
        p_reason: 'QA sweep',
        p_second_code: true,
      }),
    },
    {
      name: 'remove the client ID',
      fn: 'identifier_remove',
      args: () => ({ p_id: f.identifiers.betaClientId.id, p_reason: 'QA sweep' }),
    },
    {
      name: "change the Client side's type",
      fn: 'partner_side_set',
      args: () => ({ p_id: beta, p_side: 'client', p_values: { type: 'government' }, p_reason: 'QA sweep' }),
    },
    {
      name: 'switch the Client side off',
      fn: 'partner_side_off',
      args: () => ({ p_id: beta, p_side: 'client', p_reason: 'QA sweep' }),
    },
    {
      name: 'add a Client contract',
      fn: 'contract_save',
      args: () => ({
        p_partner: beta,
        p_id: null,
        p_values: { side: 'client', title: 'Test contract by a shut-out person', start_on: f.today },
        p_reason: 'QA sweep',
      }),
    },
    {
      name: 'edit the Client contract',
      fn: 'contract_save',
      args: () => ({
        p_partner: beta,
        p_id: f.contracts.betaClient,
        p_values: { title: 'Changed by a shut-out person' },
        p_version: 1,
        p_reason: 'QA sweep',
      }),
    },
    {
      name: 'remove the Client contract',
      fn: 'contracts_remove',
      args: () => ({ p_ids: [f.contracts.betaClient], p_reason: 'QA sweep' }),
    },
    {
      name: 'bulk-assign the Client side',
      fn: 'partner_bulk_assign',
      args: (me) => ({ p_ids: [beta], p_side: 'client', p_owner: me, p_priority: null, p_reason: 'QA sweep' }),
    },
    {
      name: 'set a credit limit',
      fn: 'credit_limit_set',
      args: () => ({
        p_partner: beta,
        p_amount: 1000,
        p_effective_from: f.today,
        p_approved_by: user('admin').id,
        p_reason: 'QA sweep',
      }),
    },
  ];
  for (const key of SHUT_OUT) {
    const api = await apiAs(key);
    const me = user(key).id;
    for (const a of attempts) {
      const before = await fingerprint(beta);
      const r = await api(a.fn, a.args(me));
      const after = await fingerprint(beta);
      const changed = before !== after;
      verdict(
        {
          area: AREA,
          user: key,
          screen: `(api) ${a.fn}`,
          check: `cannot ${a.name} of a two-sided organisation — refused in words, nothing changed`,
          detail: `${said(r)}${changed ? ' · THE CLIENT SIDE CHANGED' : ''}`,
        },
        !r.ok && inWords(r) && !changed,
      );
      const req = (r.data as { request_id?: string } | null)?.request_id;
      if (r.ok && req) await admin('undo', { p_request: req });
    }
    // on a Client-only organisation nothing at all
    for (const [fn, args] of [
      ['note_add', { p_entity: 'partner', p_id: alpha, p_kind: 'comment', p_body: 'by a shut-out person' }],
      ['activity_log', { p_partner: alpha, p_type: 'note', p_body: 'by a shut-out person' }],
      [
        'partner_update',
        { p_id: alpha, p_changes: { website: 'https://example.test' }, p_version: 1, p_reason: 'QA sweep' },
      ],
    ] as const) {
      const r = await api(fn, args);
      verdict(
        {
          area: AREA,
          user: key,
          screen: `(api) ${fn} [alpha]`,
          check: 'nothing on a Client-only organisation — refused in words',
          detail: said(r),
        },
        !r.ok && inWords(r),
      );
      const req = (r.data as { request_id?: string } | null)?.request_id;
      if (r.ok && req) await admin('undo', { p_request: req });
    }
    // what they may still do: the Supplier & partner side and the shared record (V147)
    const own = await api('contract_save', {
      p_partner: beta,
      p_id: null,
      p_values: { side: 'supplier_partner', title: `Test supplier contract by ${key}`, start_on: f.today },
      p_reason: 'QA sweep',
    });
    verdict(
      {
        area: AREA,
        user: key,
        screen: '(api) contract_save supplier_partner',
        check: 'still adds a Supplier & partner contract on the same organisation (V147)',
        detail: said(own),
      },
      own.ok,
    );
  }
  // the same calls are well formed: the admin's go through (then are undone)
  const probe = await admin('partner_status_set', {
    p_id: beta,
    p_side: 'client',
    p_status: 'prospect',
    p_note: 'QA sweep control',
  });
  info({
    area: AREA,
    user: 'admin',
    screen: '(api) partner_status_set',
    check: 'control: the same call as the admin',
    detail: said(probe),
  });
  const req = (probe.data as { request_id?: string } | null)?.request_id;
  if (req) await admin('undo', { p_request: req });
});

test('the organisation screens (P3-9) are not built: the UI routes to the Client side are listed, not passed', async () => {
  for (const what of [
    'change a Client status / owner / identifier from the organisation page',
    'the hover card on an organisation',
    'Ctrl K record search (api.search)',
    'the bell (notifications list)',
    'direct URL /partners/<id> (the catch-all placeholder shows only the address)',
  ])
    notBuilt({
      area: AREA,
      user: 'noclients',
      screen: '(UI)',
      check: what,
      detail: 'screen not built yet; covered through the Data API above',
    });
});
