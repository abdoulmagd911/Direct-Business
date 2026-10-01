'use client';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import type { Me } from '@/core/auth/me';
import { command } from '@/core/commands/command';
import { rpc } from '@/core/db/rpc';
import { formatDate } from '@/core/i18n/format';
import { avatarOf, nameOf as personName, type OrgAnswer } from '@/modules/org/types';
import { FromNoteChip } from '@/modules/my-day/screens/NoteBits';
import { Button } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { Confirm } from '@/ui/Confirm';
import { DataState } from '@/ui/DataState';
import { FollowButton } from '@/ui/FollowButton';
import { IconButton } from '@/ui/IconButton';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/ui/Menu';
import { PageHeader } from '@/ui/PageHeader';
import { PartnerLogo } from '@/ui/PartnerLogo';
import { PersonChip } from '@/ui/PersonChip';
import { ReasonDialog } from '@/ui/ReasonDialog';
import { ActivityTimeline } from '@/ui/record/ActivityTimeline';
import type { HistoryRow } from '@/ui/record/history';
import type { KeyFigure } from '@/ui/record/KeyFigures';
import { RailField, RailSection } from '@/ui/record/Rail';
import { RecordPage } from '@/ui/record/RecordPage';
import { PageFrame } from '@/ui/shell/AppShell';
import { PersonHover } from './PersonHover';
import { EditPartnerDialog } from './record/EditPartnerDialog';
import { AddNoteDialog, LogActivityDialog } from './record/LogActivityDialog';
import { ContactDialog, ContractDialog, IdentifierDialog, ReferenceDialog } from './record/RailDialogs';
import { OwnerDialog, SideDialog, SideOffDialog, StatusDialog } from './record/SideDialogs';
import { useWords } from './record/words';
import {
  SIDES,
  SIDE_PAGE,
  SIDE_ROUTE,
  nameOf,
  statusTone,
  tradeName,
  type Contact,
  type Contract,
  type ListEntry,
  type Note,
  type PartnerCard,
  type Reference,
  type Side,
  type SideFull,
} from '../types';

export type PartnerRecordData = {
  me: Me;
  side: Side;
  tab: string;
  card: PartnerCard | null;
  refused: boolean;
  org: OrgAnswer;
  notes: Note[];
  contracts: Contract[];
  history: HistoryRow[] | null;
  lists: {
    types: ListEntry[];
    tiers: ListEntry[];
    reasons: ListEntry[];
    roles: ListEntry[];
    activityTypes: ListEntry[];
    outcomes: ListEntry[];
    systems: ListEntry[];
    priorities: ListEntry[];
  };
};

const TABS = ['overview', 'activity', 'related'] as const;
/** The header figures until the setting is read for everyone (its registry default — V95; see the PR's NEED). */
const FIGURES = ['last_activity', 'next_step', 'contracts', 'contacts', 'files'] as const;

/**
 * An organisation's record page (V95 template; V98, V146–V154): the trade name with its number, the sides as chips
 * with type and status, up to five figures, Log activity · Edit · Follow and the ⋯ door for the sides (on, off,
 * status, owner). Tabs Overview (notes and activities, the sides) · Activity (the change log with Undo) · Related.
 * The rail: each side's type, tier, owner, status and fields; identifiers; contacts with roles; Direct references;
 * contracts. Every figure is the database's; nothing is added up here.
 */
export function PartnerRecord({ data }: { data: PartnerRecordData }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const words = useWords();
  const { me, side, card, refused, org, notes, contracts, history, lists } = data;
  const tab = (TABS as readonly string[]).includes(data.tab) ? data.tab : 'overview';
  const refresh = () => router.refresh();
  const people = Object.fromEntries(org.people.map((p) => [p.id, avatarOf(p, locale)]));
  const personOf = (id: string | null | undefined) => (id ? org.people.find((p) => p.id === id) : undefined);
  const nameOfPerson = (id: string) => (personOf(id) ? personName(personOf(id)!, locale) : undefined);

  const [logging, setLogging] = useState(false);
  const [noting, setNoting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sideOn, setSideOn] = useState<Side | null>(null);
  const [sideEdit, setSideEdit] = useState<SideFull | null>(null);
  const [sideOff, setSideOff] = useState<Side | null>(null);
  const [statusFor, setStatusFor] = useState<Side | null>(null);
  const [ownerFor, setOwnerFor] = useState<Side | null>(null);
  const [addingId, setAddingId] = useState(false);
  const [removingId, setRemovingId] = useState<{ id: string; value: string } | null>(null);
  const [contact, setContact] = useState<Contact | null | 'new'>(null);
  const [removingContact, setRemovingContact] = useState<Contact | null>(null);
  const [reference, setReference] = useState<Reference | null | 'new'>(null);
  const [removingRef, setRemovingRef] = useState<Reference | null>(null);
  const [contract, setContract] = useState<Contract | null | 'new'>(null);
  const [removingContract, setRemovingContract] = useState<Contract | null>(null);

  if (!card) {
    const title = side === 'client' ? t('nav.clients') : t('nav.suppliers_partners');
    return (
      <PageFrame>
        <PageHeader crumbs={[{ label: title, href: SIDE_ROUTE[side] }]} title={t('entity.partner')} />
        <DataState
          kind={refused ? 'no-access' : 'failed'}
          what={t('entity.partner')}
          onRetry={refresh}
          retryLabel={t('common.tryAgain')}
        />
      </PageFrame>
    );
  }

  const sidesOn = card.sides.filter((s) => s.on);
  const sideOf = (k: Side) => card.sides.find((s) => s.side === k && s.on) ?? null;
  const fullOn = (k: Side) => me.levels[SIDE_PAGE[k]] === 'full';
  const canAssign = (k: Side) => me.capabilities.includes(`${SIDE_PAGE[k]}.assign`);
  const isOwner = (s: SideFull | null) => !!s && s.owner_id === me.person.id;
  const mayWrite = sidesOn.some((s) => fullOn(s.side) || (me.levels[SIDE_PAGE[s.side]] === 'own' && isOwner(s)));
  const mayIdentify =
    me.capabilities.includes('clients.identify') || me.capabilities.includes('suppliers_partners.identify');
  const listName = (list: ListEntry[], key: string | null | undefined, byId = false) =>
    nameOf(
      list.find((x) => (byId ? x.id === key : x.key === key)),
      locale,
    );
  const base = SIDE_ROUTE[sideOf(side) ? side : (sidesOn[0]?.side ?? side)];
  const remove = (done: string, fn: string, ids: string[]) =>
    command(
      words(done),
      () => rpc(fn as 'contacts_remove', { p_ids: ids }) as Promise<{ request_id?: string | null } | null>,
      { after: refresh },
    );

  const figures: KeyFigure[] = FIGURES.map((k) => {
    switch (k) {
      case 'last_activity':
        return {
          key: k,
          label: t('partners.figures.last_activity'),
          value: card.last_activity_on ? formatDate(card.last_activity_on, locale, { dateStyle: 'medium' }) : null,
        };
      case 'next_step':
        return {
          key: k,
          label: t('partners.figures.next_step'),
          value: card.next_step ? formatDate(card.next_step.on, locale, { dateStyle: 'medium' }) : null,
          note: card.next_step?.text ?? undefined,
        };
      case 'contracts':
        return { key: k, label: t('partners.figures.contracts'), value: String(card.counts.contracts) };
      case 'contacts':
        return { key: k, label: t('partners.figures.contacts'), value: String(card.contacts.length) };
      case 'files':
        return { key: k, label: t('partners.figures.files'), value: String(card.counts.files) };
    }
  });

  const actions = (
    <>
      {mayWrite ? (
        <Button variant="primary" icon={<Plus />} onClick={() => setLogging(true)} data-activity-log>
          {t('partners.activity.log')}
        </Button>
      ) : null}
      {mayWrite ? (
        <Button onClick={() => setEditing(true)} data-partner-edit>
          {t('common.edit')}
        </Button>
      ) : null}
      <FollowButton entity="partner" id={card.id} />
      <Menu>
        <MenuTrigger asChild>
          <Button aria-label={t('common.more')} data-partner-more>
            ⋯
          </Button>
        </MenuTrigger>
        <MenuContent>
          {SIDES.map((k) => {
            const s = sideOf(k);
            const label = t(`partners.side.${k}`);
            if (!s)
              return fullOn(k) ? (
                <MenuItem key={k} onSelect={() => setSideOn(k)} data-side-on={k}>
                  {t('partners.sideDialog.switchOn', { side: label })}
                </MenuItem>
              ) : null;
            return (
              <div key={k}>
                {fullOn(k) ? (
                  <MenuItem onSelect={() => setSideEdit(s)} data-side-edit={k}>
                    {t('partners.sideDialog.change', { side: label })}
                  </MenuItem>
                ) : null}
                {isOwner(s) || canAssign(k) ? (
                  <MenuItem onSelect={() => setStatusFor(k)} data-status-set={k}>
                    {t('partners.statusDialog.action')} · {label}
                  </MenuItem>
                ) : null}
                {canAssign(k) ? (
                  <MenuItem onSelect={() => setOwnerFor(k)} data-owner-set={k}>
                    {t('partners.ownerDialog.action')} · {label}
                  </MenuItem>
                ) : null}
                {fullOn(k) && sidesOn.length > 1 ? (
                  <MenuItem onSelect={() => setSideOff(k)} data-side-off={k}>
                    {t('partners.sideDialog.switchOffAction', { side: label })}
                  </MenuItem>
                ) : null}
                <MenuSeparator />
              </div>
            );
          })}
          {mayWrite ? (
            <MenuItem onSelect={() => setNoting(true)} data-note-add>
              {t('partners.note.add')}
            </MenuItem>
          ) : null}
        </MenuContent>
      </Menu>
    </>
  );

  const identifierGroups = (
    ['payments_client_id', 'discount_code', 'vat', 'cr', 'email', 'phone', 'name'] as const
  ).map((kind) => ({
    kind,
    rows: card.identifiers.filter((i) => i.kind === kind && (kind !== 'name' || i.subkind === 'alias')),
  }));
  const contractState = (c: Contract) => {
    const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
    if (c.start_on > day) return t('partners.contract.state.not_started');
    if (!c.end_on) return t('partners.contract.state.open');
    if (c.end_on < day) return t('partners.contract.state.expired');
    const days = Math.round((Date.parse(c.end_on) - Date.parse(day)) / 86_400_000);
    return days <= 30 ? t('partners.contract.state.expiring', { days }) : t('partners.contract.state.active');
  };

  const rail = (
    <>
      {SIDES.map((k) => {
        const s = sideOf(k);
        if (!s) return null;
        const owner = personOf(s.owner_id);
        return (
          <RailSection key={k} title={t(`partners.sides.${k}`)}>
            <RailField label={t('partners.columns.type')}>{listName(lists.types, s.type) || s.type}</RailField>
            <RailField
              label={t('partners.tier')}
              empty={!s.tier_id}
              add={
                fullOn(k) ? (
                  <Button variant="link" size="xs" onClick={() => setSideEdit(s)}>
                    {t('common.addNew')}
                  </Button>
                ) : null
              }
            >
              {listName(lists.tiers, s.tier_id, true)}
            </RailField>
            <RailField
              label={k === 'client' ? t('partners.accountManager') : t('partners.relationshipOwner')}
              empty={!owner}
              add={
                canAssign(k) ? (
                  <Button variant="link" size="xs" onClick={() => setOwnerFor(k)}>
                    {t('common.addNew')}
                  </Button>
                ) : null
              }
            >
              {owner ? (
                <PersonHover id={owner.id}>
                  <PersonChip person={avatarOf(owner, locale)} href={`/people/${owner.id}`} />
                </PersonHover>
              ) : null}
            </RailField>
            <RailField
              label={t('partners.columns.status')}
              empty={!s.status}
              add={
                isOwner(s) || canAssign(k) ? (
                  <Button variant="link" size="xs" onClick={() => setStatusFor(k)}>
                    {t('common.addNew')}
                  </Button>
                ) : null
              }
            >
              {s.status ? (
                <StatusChip tone={statusTone(s.status)}>{t(`partners.status.${s.status}`)}</StatusChip>
              ) : null}
            </RailField>
            <RailField label={t('partners.since')}>
              {s.since ? formatDate(s.since, locale, { dateStyle: 'medium' }) : '—'}
            </RailField>
            {Object.entries(s.fields ?? {}).map(([key, value]) => (
              <RailField key={key} label={key}>
                {value === null || value === undefined || value === '' ? '—' : String(value)}
              </RailField>
            ))}
          </RailSection>
        );
      })}
      <RailSection
        title={t('partners.identifier.title')}
        footer={
          mayIdentify ? (
            <Button size="xs" variant="ghost" icon={<Plus />} onClick={() => setAddingId(true)} data-identifier-add>
              {t('partners.identifier.add')}
            </Button>
          ) : null
        }
      >
        {identifierGroups.map((g) => (
          <RailField
            key={g.kind}
            label={t(`partners.identifier.kinds.${g.kind}`)}
            empty={!g.rows.length}
            add={
              mayIdentify ? (
                <Button variant="link" size="xs" onClick={() => setAddingId(true)}>
                  {t('common.addNew')}
                </Button>
              ) : null
            }
          >
            <ul className="flex flex-col gap-1">
              {g.rows.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2" data-identifier={i.id}>
                  <span className="font-data">
                    {i.value}
                    {i.subkind && g.kind !== 'name' ? (
                      <span className="ms-1 text-xs text-muted">{t(`partners.identifier.subkinds.${i.subkind}`)}</span>
                    ) : null}
                  </span>
                  {mayIdentify ? (
                    <IconButton
                      label={t('partners.identifier.remove')}
                      icon={<MoreHorizontal />}
                      size="sm"
                      onClick={() => setRemovingId({ id: i.id, value: i.value })}
                      data-identifier-remove
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </RailField>
        ))}
      </RailSection>
      <RailSection title={t('partners.contact.title')} plain>
        {card.contacts.length ? (
          <ul className="flex flex-col gap-2">
            {card.contacts.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-2 text-sm" data-contact={c.id}>
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">
                    {locale === 'ar' && c.name_ar ? c.name_ar : c.name_en}
                    {c.is_primary ? (
                      <StatusChip tone="info" className="ms-1.5">
                        {t('partners.contact.primary')}
                      </StatusChip>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted">
                    {[listName(lists.roles, c.role_id, true), c.job_title].filter(Boolean).join(' · ')}
                  </span>
                  {/* one tap calls or writes (the 3-job phone test, V217): 44 px tall on a phone */}
                  {c.phone || c.email ? (
                    <span className="flex flex-wrap gap-x-3 text-sm">
                      {c.phone ? (
                        <a
                          href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}
                          className="inline-flex min-h-11 items-center font-data text-link sm:min-h-0"
                          data-contact-phone
                        >
                          {c.phone}
                        </a>
                      ) : null}
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          className="inline-flex min-h-11 items-center truncate text-link sm:min-h-0"
                          data-contact-email
                        >
                          {c.email}
                        </a>
                      ) : null}
                    </span>
                  ) : null}
                </span>
                {mayWrite ? (
                  <Menu>
                    <MenuTrigger asChild>
                      <IconButton label={t('common.more')} icon={<MoreHorizontal />} size="sm" data-contact-menu />
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem onSelect={() => setContact(c)}>{t('common.edit')}</MenuItem>
                      <MenuItem onSelect={() => setRemovingContact(c)}>{t('common.remove')}</MenuItem>
                    </MenuContent>
                  </Menu>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {mayWrite ? (
          <Button size="xs" variant="ghost" icon={<Plus />} onClick={() => setContact('new')} data-contact-add>
            {t('partners.contact.add')}
          </Button>
        ) : null}
      </RailSection>
      <RailSection title={t('partners.reference.title')} plain>
        {card.references.length ? (
          <ul className="flex flex-col gap-1.5">
            {card.references.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-sm" data-reference={r.id}>
                <span className="flex min-w-0 flex-col">
                  <span className="text-xs text-muted">
                    {locale === 'ar' && r.system_ar ? r.system_ar : r.system_en}
                    {r.side ? ` · ${t(`partners.side.${r.side}`)}` : ''}
                  </span>
                  {r.link ? (
                    <a
                      href={r.link}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate font-data text-link hover:underline"
                    >
                      {r.value}
                    </a>
                  ) : (
                    <span className="font-data">{r.value}</span>
                  )}
                </span>
                {mayWrite ? (
                  <Menu>
                    <MenuTrigger asChild>
                      <IconButton label={t('common.more')} icon={<MoreHorizontal />} size="sm" data-reference-menu />
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem onSelect={() => setReference(r)}>{t('common.edit')}</MenuItem>
                      <MenuItem onSelect={() => setRemovingRef(r)}>{t('common.remove')}</MenuItem>
                    </MenuContent>
                  </Menu>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {mayWrite ? (
          <Button size="xs" variant="ghost" icon={<Plus />} onClick={() => setReference('new')} data-reference-add>
            {t('partners.reference.add')}
          </Button>
        ) : null}
      </RailSection>
      <RailSection title={t('partners.contract.title')} plain>
        {contracts.length ? (
          <ul className="flex flex-col gap-2">
            {contracts.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-2 text-sm" data-contract={c.id}>
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{c.title}</span>
                  <span className="text-xs text-muted">
                    {t(`partners.side.${c.side}`)} · {formatDate(c.start_on, locale, { dateStyle: 'medium' })}
                    {c.end_on ? ` – ${formatDate(c.end_on, locale, { dateStyle: 'medium' })}` : ''}
                  </span>
                  <StatusChip
                    tone={
                      contractState(c) === t('partners.contract.state.expired')
                        ? 'danger'
                        : contractState(c).startsWith(t('partners.contract.state.expiring', { days: 0 }).split(' ')[0]!)
                          ? 'warning'
                          : 'neutral'
                    }
                    className="mt-1 w-fit"
                  >
                    {contractState(c)}
                  </StatusChip>
                </span>
                {fullOn(c.side) || isOwner(sideOf(c.side)) ? (
                  <Menu>
                    <MenuTrigger asChild>
                      <IconButton label={t('common.more')} icon={<MoreHorizontal />} size="sm" data-contract-menu />
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem onSelect={() => setContract(c)}>{t('common.edit')}</MenuItem>
                      <MenuItem onSelect={() => setRemovingContract(c)}>{t('common.remove')}</MenuItem>
                    </MenuContent>
                  </Menu>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {mayWrite ? (
          <Button size="xs" variant="ghost" icon={<Plus />} onClick={() => setContract('new')} data-contract-add>
            {t('partners.contract.add')}
          </Button>
        ) : null}
      </RailSection>
      <RailSection title={t('partners.details')}>
        <RailField label={t('partners.fields.number')}>
          <span className="font-data">{card.number}</span>
        </RailField>
        {(
          [
            ['officialNameEn', card.official_name_en],
            ['officialNameAr', card.official_name_ar],
            ['website', card.website],
            ['city', card.city],
            ['country', card.country],
            ['address', card.address],
            ['clientSince', card.client_since ? formatDate(card.client_since, locale, { dateStyle: 'medium' }) : null],
            ['notes', card.notes],
          ] as const
        ).map(([k, v]) => (
          <RailField
            key={k}
            label={t(`partners.fields.${k}`)}
            empty={!v}
            add={
              mayWrite ? (
                <Button variant="link" size="xs" onClick={() => setEditing(true)}>
                  {t('common.addNew')}
                </Button>
              ) : null
            }
          >
            {k === 'website' && v ? (
              <a href={v} target="_blank" rel="noreferrer" className="break-all text-link hover:underline">
                {v}
              </a>
            ) : (
              v
            )}
          </RailField>
        ))}
        <RailField
          label={t('partners.priority')}
          empty={!card.priority_id}
          add={
            mayWrite ? (
              <Button variant="link" size="xs" onClick={() => setEditing(true)}>
                {t('common.addNew')}
              </Button>
            ) : null
          }
        >
          {listName(lists.priorities, card.priority_id, true)}
        </RailField>
      </RailSection>
    </>
  );

  const noteLine = (n: Note): ReactNode => {
    const who = personOf(n.author_id);
    const head =
      n.kind === 'activity'
        ? [
            locale === 'ar' && n.type_ar ? n.type_ar : n.type_en,
            locale === 'ar' && n.outcome_ar ? n.outcome_ar : n.outcome_en,
          ]
            .filter(Boolean)
            .join(' · ')
        : t(`partners.note.kinds.${n.kind}`);
    return (
      <li key={n.id} className="flex gap-3 py-3" data-note={n.id} data-note-kind={n.kind}>
        <span className="mt-1 size-2 shrink-0 rounded-pill bg-border-strong" aria-hidden="true" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{head}</span>
            <span className="font-data text-xs text-muted">
              {formatDate(n.happened_on, locale, { dateStyle: 'medium' })}
            </span>
            {n.logged_late ? <StatusChip tone="warning">{t('partners.activity.loggedLate')}</StatusChip> : null}
            {who ? (
              <span className="text-xs text-muted">{t('partners.activity.by', { name: personName(who, locale) })}</span>
            ) : null}
            {n.from_note ? <FromNoteChip note={n.from_note} /> : null}
          </span>
          {n.body ? <span className="whitespace-pre-wrap text-sm">{n.body}</span> : null}
          {n.next_step ? (
            <span className="text-sm text-muted">
              {t('partners.activity.nextStep')}: {n.next_step}
              {n.next_step_on ? ` · ${formatDate(n.next_step_on, locale, { dateStyle: 'medium' })}` : ''}
            </span>
          ) : null}
        </span>
      </li>
    );
  };

  return (
    <>
      <RecordPage
        crumbs={[{ label: side === 'client' ? t('nav.clients') : t('nav.suppliers_partners'), href: SIDE_ROUTE[side] }]}
        back={{ href: SIDE_ROUTE[side], label: t('record.back') }}
        avatar={<PartnerLogo name={card.trade_name_en} size="xl" />}
        title={tradeName(card, locale)}
        subtitle={[card.number, locale === 'ar' ? card.trade_name_en : card.trade_name_ar].filter(Boolean).join(' · ')}
        chips={
          <>
            {sidesOn.map((s) => (
              <StatusChip key={s.side} tone={statusTone(s.status)}>
                {t(`partners.side.${s.side}`)} · {listName(lists.types, s.type) || s.type}
                {s.status ? ` · ${t(`partners.status.${s.status}`)}` : ''}
              </StatusChip>
            ))}
            {card.key_partner ? <StatusChip tone="info">{t('partners.keyPartner')}</StatusChip> : null}
            {card.flags.map((f) => (
              <StatusChip key={f} tone={f === 'stale' ? 'warning' : 'info'}>
                {t(`partners.flags.${f}`)}
              </StatusChip>
            ))}
            {card.archived_at ? <StatusChip tone="neutral">{t('partners.archived')}</StatusChip> : null}
          </>
        }
        figures={figures}
        actions={actions}
        tabs={TABS.map((k) => ({
          key: k,
          label: t(`partners.tabs.${k}`),
          count: k === 'activity' && history ? history.length : undefined,
        }))}
        tab={tab}
        tabHref={(k) => `${base}/${card.id}?tab=${k}`}
        rail={rail}
        words={{ tabs: t('record.tabs'), notMeasured: t('common.notMeasured') }}
      >
        {tab === 'overview' ? (
          <section className="rounded-lg border border-border bg-raised px-5 py-2" data-partner-notes>
            <div className="flex items-center justify-between gap-3 border-b border-border py-2.5">
              <h2 className="text-base font-semibold">{t('partners.activity.timeline')}</h2>
              {mayWrite ? (
                <span className="flex gap-2">
                  <Button size="sm" onClick={() => setNoting(true)} data-note-add-inline>
                    {t('partners.note.add')}
                  </Button>
                  <Button size="sm" variant="primary" icon={<Plus />} onClick={() => setLogging(true)}>
                    {t('partners.activity.log')}
                  </Button>
                </span>
              ) : null}
            </div>
            {notes.length ? (
              <ul className="divide-y divide-border">{notes.map(noteLine)}</ul>
            ) : (
              <DataState kind="empty" message={t('partners.activity.none')} />
            )}
          </section>
        ) : null}
        {tab === 'activity' ? (
          history ? (
            <ActivityTimeline rows={history} people={people} onChanged={refresh} />
          ) : (
            <DataState kind="no-access" what={t('record.activity')} />
          )
        ) : null}
        {tab === 'related' ? (
          <section className="rounded-lg border border-border bg-raised p-5" data-partner-related>
            {sidesOn.map((s) => (
              <div key={s.side} className="mb-4" data-side-history={s.side}>
                <h3 className="mb-2 text-sm font-semibold">
                  {t(`partners.sides.${s.side}`)} · {t('partners.statusDialog.history')}
                </h3>
                {s.status_history.length ? (
                  <ul className="divide-y divide-border text-sm">
                    {s.status_history.map((h) => (
                      <li key={h.id} className="flex flex-wrap items-center gap-2 py-2">
                        <StatusChip tone={statusTone(h.status)}>{t(`partners.status.${h.status}`)}</StatusChip>
                        <span className="font-data text-xs text-muted">
                          {formatDate(h.effective_on, locale, { dateStyle: 'medium' })}
                        </span>
                        {h.reason_id ? (
                          <span className="text-muted">{listName(lists.reasons, h.reason_id, true)}</span>
                        ) : null}
                        {h.note ? <span className="text-muted">{h.note}</span> : null}
                        {personOf(h.set_by) ? (
                          <span className="text-xs text-muted">
                            {t('partners.activity.by', { name: personName(personOf(h.set_by)!, locale) })}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <DataState kind="empty" message={t('state.empty')} />
                )}
                <h3 className="mb-2 mt-4 text-sm font-semibold">
                  {t(`partners.sides.${s.side}`)} · {t('partners.ownerDialog.history')}
                </h3>
                {s.owners.length ? (
                  <ul className="divide-y divide-border text-sm">
                    {s.owners.map((o) => (
                      <li key={o.id} className="flex flex-wrap items-center gap-2 py-2">
                        {personOf(o.person_id) ? (
                          <PersonChip
                            person={avatarOf(personOf(o.person_id)!, locale)}
                            href={`/people/${o.person_id}`}
                          />
                        ) : null}
                        <span className="font-data text-xs text-muted">
                          {formatDate(o.from, locale, { dateStyle: 'medium' })}
                          {o.to ? ` – ${formatDate(o.to, locale, { dateStyle: 'medium' })}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <DataState kind="empty" message={t('state.empty')} />
                )}
              </div>
            ))}
          </section>
        ) : null}
      </RecordPage>

      <LogActivityDialog
        open={logging}
        onOpenChange={setLogging}
        partnerId={card.id}
        types={lists.activityTypes}
        outcomes={lists.outcomes}
        onDone={refresh}
      />
      <AddNoteDialog open={noting} onOpenChange={setNoting} partnerId={card.id} onDone={refresh} />
      <EditPartnerDialog
        open={editing}
        onOpenChange={setEditing}
        card={card}
        priorities={lists.priorities}
        nameOfPerson={nameOfPerson}
        onDone={refresh}
      />
      {sideOn ? (
        <SideDialog
          open
          onOpenChange={(o) => !o && setSideOn(null)}
          partnerId={card.id}
          side={sideOn}
          current={null}
          me={me}
          org={org}
          types={lists.types.filter((x) => x.side === sideOn)}
          tiers={lists.tiers.filter((x) => x.side === sideOn)}
          onDone={refresh}
        />
      ) : null}
      {sideEdit ? (
        <SideDialog
          open
          onOpenChange={(o) => !o && setSideEdit(null)}
          partnerId={card.id}
          side={sideEdit.side}
          current={sideEdit}
          me={me}
          org={org}
          types={lists.types.filter((x) => x.side === sideEdit.side)}
          tiers={lists.tiers.filter((x) => x.side === sideEdit.side)}
          onDone={refresh}
        />
      ) : null}
      {sideOff ? (
        <SideOffDialog
          open
          onOpenChange={(o) => !o && setSideOff(null)}
          partnerId={card.id}
          side={sideOff}
          onDone={refresh}
        />
      ) : null}
      {statusFor ? (
        <StatusDialog
          open
          onOpenChange={(o) => !o && setStatusFor(null)}
          partnerId={card.id}
          side={statusFor}
          current={sideOf(statusFor)?.status ?? null}
          reasons={lists.reasons}
          onDone={refresh}
        />
      ) : null}
      {ownerFor ? (
        <OwnerDialog
          open
          onOpenChange={(o) => !o && setOwnerFor(null)}
          partnerId={card.id}
          side={ownerFor}
          current={sideOf(ownerFor)?.owner_id ?? null}
          org={org}
          onDone={refresh}
        />
      ) : null}
      <IdentifierDialog
        open={addingId}
        onOpenChange={setAddingId}
        partnerId={card.id}
        clientOn={!!sideOf('client')}
        onDone={refresh}
      />
      <ReasonDialog
        open={removingId !== null}
        onOpenChange={(o) => !o && setRemovingId(null)}
        title={t('partners.identifier.removeTitle', { value: removingId?.value ?? '' })}
        destructive
        onSave={async (reason) => {
          const id = removingId!.id;
          setRemovingId(null);
          await command(
            words(t('partners.identifier.removed')),
            () =>
              rpc('identifier_remove', { p_id: id, p_reason: reason }) as Promise<{
                request_id?: string | null;
              } | null>,
            { after: refresh },
          );
        }}
        words={{
          reason: t('common.reason'),
          save: t('common.remove'),
          cancel: t('common.cancel'),
          reasonRequired: t('settings.form.reasonRequired'),
        }}
      />
      {contact !== null ? (
        <ContactDialog
          open
          onOpenChange={(o) => !o && setContact(null)}
          partnerId={card.id}
          current={contact === 'new' ? null : contact}
          roles={lists.roles}
          onDone={refresh}
        />
      ) : null}
      <Confirm
        open={removingContact !== null}
        onOpenChange={(o) => !o && setRemovingContact(null)}
        title={t('partners.contact.removeTitle', { name: removingContact?.name_en ?? '' })}
        body={t('confirm.body', { item: removingContact?.name_en ?? '' })}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('common.remove')}
        onConfirm={async () => {
          const c = removingContact!;
          setRemovingContact(null);
          await remove(t('partners.contact.removed', { name: c.name_en }), 'contacts_remove', [c.id]);
        }}
      />
      {reference !== null ? (
        <ReferenceDialog
          open
          onOpenChange={(o) => !o && setReference(null)}
          partnerId={card.id}
          current={reference === 'new' ? null : reference}
          systems={lists.systems}
          sidesOn={sidesOn.map((s) => s.side)}
          onDone={refresh}
        />
      ) : null}
      <Confirm
        open={removingRef !== null}
        onOpenChange={(o) => !o && setRemovingRef(null)}
        title={t('partners.reference.removeTitle', { value: removingRef?.value ?? '' })}
        body={t('confirm.body', { item: removingRef?.value ?? '' })}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('common.remove')}
        onConfirm={async () => {
          const r = removingRef!;
          setRemovingRef(null);
          await remove(t('partners.reference.removed'), 'references_remove', [r.id]);
        }}
      />
      {contract !== null ? (
        <ContractDialog
          open
          onOpenChange={(o) => !o && setContract(null)}
          partnerId={card.id}
          current={contract === 'new' ? null : contract}
          sidesOn={sidesOn}
          onDone={refresh}
        />
      ) : null}
      <Confirm
        open={removingContract !== null}
        onOpenChange={(o) => !o && setRemovingContract(null)}
        title={t('partners.contract.removeTitle', { title: removingContract?.title ?? '' })}
        body={t('confirm.body', { item: removingContract?.title ?? '' })}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('common.remove')}
        onConfirm={async () => {
          const c = removingContract!;
          setRemovingContract(null);
          await remove(t('partners.contract.removed', { title: c.title }), 'contracts_remove', [c.id]);
        }}
      />
    </>
  );
}
