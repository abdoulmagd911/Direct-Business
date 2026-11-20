'use client';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Checkbox } from './Checkbox';
import { cn } from './cn';

export type { ColumnDef };

/** What inside a row answers a press itself, so the row does not (Landing 34). */
const OWN_CONTROL = 'a, button, input, select, textarea, label, [role="menu"], [role="menuitem"], [role="dialog"]';

/** True when a press landed on a control inside the row (a link, a button, a menu's item): it is that control's. */
export function pressIsControls(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(OWN_CONTROL) !== null;
}

/**
 * The list table: TanStack Table + Virtual. Row height comes from the density tokens (48 px
 * comfortable, 40 px compact), a card with a soft-fill sticky header (600 12/16, muted), hairline dividers, hover on
 * the soft fill, numbers end-aligned in mono, the selected row on accent-soft. Row click opens the detail panel; the list stays interactive. Rows are `<a>`-free:
 * cells hold EntityLinks, the row itself is a button for keyboard users.
 */
export function DataTable<T>({
  columns,
  data,
  getRowId,
  onRowClick,
  selectedId,
  selectable = false,
  rowSelection,
  onRowSelectionChange,
  sorting,
  onSortingChange,
  columnVisibility,
  onColumnVisibilityChange,
  /** FIX-01: which rows may be selected — absent, every row may be, as before. */
  canSelectRow,
  labels,
  className,
  maxHeight = '70dvh',
  emptyState,
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedId?: string | null;
  selectable?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (s: RowSelectionState) => void;
  sorting?: SortingState;
  onSortingChange?: (s: SortingState) => void;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: (s: VisibilityState) => void;
  canSelectRow?: (row: T) => boolean;
  labels: { selectRow: string; selectAll: string };
  className?: string;
  maxHeight?: string;
  emptyState?: ReactNode;
}) {
  // TanStack Table and Virtual mutate one stable instance; the React Compiler must not memoise their reads.
  'use no memo';
  const [innerSorting, setInnerSorting] = useState<SortingState>([]);
  const [innerSel, setInnerSel] = useState<RowSelectionState>({});
  const [innerVis, setInnerVis] = useState<VisibilityState>({});
  const sort = sorting ?? innerSorting;
  const sel = rowSelection ?? innerSel;
  const vis = columnVisibility ?? innerVis;

  const selectionColumn: ColumnDef<T, unknown> = {
    id: '__select',
    size: 44,
    enableSorting: false,
    header: ({ table }) => (
      <Checkbox
        label={labels.selectAll}
        checked={table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? 'indeterminate' : false}
        onCheckedChange={(v) => table.toggleAllRowsSelected(v)}
      />
    ),
    cell: ({ row }) => (
      <span onClick={(e) => e.stopPropagation()}>
        <Checkbox
          label={labels.selectRow}
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(v)}
          disabled={!row.getCanSelect()}
        />
      </span>
    ),
  };

  const table = useReactTable({
    data,
    columns: selectable ? [selectionColumn, ...columns] : columns,
    getRowId,
    state: { sorting: sort, rowSelection: sel, columnVisibility: vis },
    onSortingChange: (u) => {
      const next = typeof u === 'function' ? u(sort) : u;
      (onSortingChange ?? setInnerSorting)(next);
    },
    onRowSelectionChange: (u) => {
      const next = typeof u === 'function' ? u(sel) : u;
      (onRowSelectionChange ?? setInnerSel)(next);
    },
    onColumnVisibilityChange: (u) => {
      const next = typeof u === 'function' ? u(vis) : u;
      (onColumnVisibilityChange ?? setInnerVis)(next);
    },
    enableRowSelection: canSelectRow ? (row) => canSelectRow(row.original) : selectable,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [rowH, setRowH] = useState(48);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const read = () => setRowH(parseFloat(getComputedStyle(el).getPropertyValue('--row-h')) || 48);
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-density'] });
    return () => obs.disconnect();
  }, []);

  const rows = table.getRowModel().rows;
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowH,
    overscan: 12,
  });
  const items = virtual.getVirtualItems();
  const padTop = items[0]?.start ?? 0;
  const padBottom = virtual.getTotalSize() - (items[items.length - 1]?.end ?? 0);

  // A clickable row is focusable (Enter/Space opens it) but is not a widget: the links and checkboxes
  // inside stay their own controls (axe nested-interactive).
  // Landing 34: a press on a control inside the row is that control's alone. A click on a cell's link used to bubble
  // to the row and open the record a second time — two navigations (and two record reads) for one click — and a
  // menu's item, though drawn in a portal, bubbles here through React's tree the same way.
  const rowProps = (row: Row<T>) =>
    onRowClick
      ? {
          tabIndex: 0,
          onClick: (e: React.MouseEvent) => {
            if (pressIsControls(e.target)) return;
            onRowClick(row.original);
          },
          onKeyDown: (e: React.KeyboardEvent) => {
            if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
              e.preventDefault();
              onRowClick(row.original);
            }
          },
        }
      : {};

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-raised shadow-1', className)} data-table>
      <div ref={scrollRef} className="overflow-auto scrollbar-thin" style={{ maxHeight }}>
        <table className="w-full min-w-[480px] border-collapse text-[length:var(--row-font)]">
          {/* Landing 34: each header cell sticks, not only the group (a sticky <thead> is not honoured everywhere, and
              with collapsed borders its hairline scrolled away, so the row under it showed through, half cut) */}
          <thead className="sticky top-0 z-[1] bg-surface">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const numeric = (h.column.columnDef.meta as { numeric?: boolean } | undefined)?.numeric;
                  const sorted = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      style={{ width: h.getSize() !== 150 ? h.getSize() : undefined }}
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                      className={cn(
                        'sticky top-0 z-[1] h-[var(--row-h-head)] whitespace-nowrap border-b border-border bg-surface px-3 text-start text-xs font-semibold leading-4 text-muted shadow-[inset_0_-1px_0_var(--color-border)]',
                        numeric && 'text-end',
                      )}
                    >
                      {h.isPlaceholder ? null : h.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 rounded-sm hover:text-strong"
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === 'asc' ? (
                            <ChevronUp className="size-3.5" aria-hidden="true" />
                          ) : sorted === 'desc' ? (
                            <ChevronDown className="size-3.5" aria-hidden="true" />
                          ) : null}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {padTop > 0 ? (
              <tr aria-hidden="true">
                <td style={{ height: padTop, padding: 0 }} colSpan={table.getAllLeafColumns().length} />
              </tr>
            ) : null}
            {items.map((vi) => {
              const row = rows[vi.index]!;
              const isSel = selectedId !== undefined && selectedId !== null && row.id === selectedId;
              return (
                <tr
                  key={row.id}
                  data-index={vi.index}
                  // Landing 34: a row is measured as drawn (a wrapped name or two flags make it taller than the
                  // density's height), so the rows above the window are spaced by their real heights
                  ref={virtual.measureElement}
                  data-selected={isSel || undefined}
                  aria-current={isSel ? 'true' : undefined}
                  {...rowProps(row)}
                  className={cn(
                    'border-b border-border transition-colors duration-[var(--dur-fast)] last:border-b-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                    onRowClick && 'cursor-pointer hover:bg-surface',
                    isSel && 'bg-accent-soft hover:bg-accent-soft',
                    row.getIsSelected() && !isSel && 'bg-[color-mix(in_srgb,var(--sel)_7%,var(--raised))]',
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const numeric = (cell.column.columnDef.meta as { numeric?: boolean } | undefined)?.numeric;
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          'h-[var(--row-h)] whitespace-nowrap px-3',
                          numeric && 'text-end font-data tabular text-[.96em]',
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {padBottom > 0 ? (
              <tr aria-hidden="true">
                <td style={{ height: padBottom, padding: 0 }} colSpan={table.getAllLeafColumns().length} />
              </tr>
            ) : null}
          </tbody>
        </table>
        {rows.length === 0 && emptyState ? <div className="p-4">{emptyState}</div> : null}
      </div>
    </div>
  );
}
