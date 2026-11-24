// Landing 47 (A12): a postpaid organisation has no wallet top-up — it settles by hand with the Finance team — so its
// Finance tab shows none. An organisation is postpaid here when it holds a postpaid client ID and no prepaid one; one
// that holds both keeps its wallet (the prepaid ID has one). One rule, read by the tab and by its tests.
type ClientId = { kind: string; subkind?: string | null };

export function isPostpaidOnly(identifiers: readonly ClientId[]): boolean {
  const ids = identifiers.filter((i) => i.kind === 'payments_client_id');
  return ids.some((i) => i.subkind === 'postpaid') && !ids.some((i) => i.subkind === 'prepaid');
}
