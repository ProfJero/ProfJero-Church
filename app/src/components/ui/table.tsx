import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from './input';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sort?: (row: T) => string | number;
  className?: string;
  align?: 'left' | 'right' | 'center';
  /** Hide below this breakpoint on the desktop table. */
  hideBelow?: 'md' | 'lg' | 'xl';
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Phone layout for one row. Defaults to the table squeezed horizontally. */
  mobile?: (row: T) => ReactNode;
  pageSize?: number;
  empty?: ReactNode;
  loading?: ReactNode;
  isLoading?: boolean;
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (s: Set<string>) => void;
  footer?: ReactNode;
  className?: string;
}

const hide = { md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' };

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  mobile,
  pageSize = 25,
  empty,
  loading,
  isLoading,
  defaultSort,
  selectable,
  selected,
  onSelectedChange,
  footer,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(defaultSort);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const get = col.sort;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
      return sort.dir === 'asc' ? r : -r;
    });
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => {
    if (page > pages - 1) setPage(0);
  }, [pages, page]);
  const visible = sorted.slice(page * pageSize, page * pageSize + pageSize);

  if (isLoading) return <div className={cn('card overflow-hidden', className)}>{loading}</div>;
  if (rows.length === 0) return <div className={cn('card', className)}>{empty}</div>;

  const allOnPage = visible.length > 0 && visible.every((r) => selected?.has(rowKey(r)));
  const toggleAll = () => {
    const next = new Set(selected);
    visible.forEach((r) => (allOnPage ? next.delete(rowKey(r)) : next.add(rowKey(r))));
    onSelectedChange?.(next);
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange?.(next);
  };

  return (
    <div className={cn('card overflow-hidden', className)}>
      {mobile && (
        <ul className="divide-y divide-line sm:hidden">
          {visible.map((row) => (
            <li key={rowKey(row)}>
              <div
                role={onRowClick ? 'button' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={() => onRowClick?.(row)}
                onKeyDown={(e) => e.key === 'Enter' && onRowClick?.(row)}
                className={cn('flex items-center gap-3 px-4 py-3', onRowClick && 'cursor-pointer active:bg-surface-2')}
              >
                {selectable && (
                  <Checkbox checked={selected?.has(rowKey(row)) ?? false} onClick={(e) => e.stopPropagation()} onChange={() => toggle(rowKey(row))} aria-label="Select row" />
                )}
                <div className="min-w-0 flex-1">{mobile(row)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className={cn('overflow-x-auto', mobile && 'hidden sm:block')}>
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/60">
              {selectable && (
                <th className="w-10 px-4 py-2.5">
                  <Checkbox checked={allOnPage} onChange={toggleAll} aria-label="Select all on page" />
                </th>
              )}
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={cn(
                      'whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-fg-3',
                      c.align === 'right' && 'text-right',
                      c.align === 'center' && 'text-center',
                      c.hideBelow && hide[c.hideBelow],
                      c.className,
                    )}
                  >
                    {c.sort ? (
                      <button
                        type="button"
                        className={cn('inline-flex items-center gap-1 rounded hover:text-fg', active && 'text-fg')}
                        onClick={() => setSort({ key: c.key, dir: active && sort?.dir === 'asc' ? 'desc' : 'asc' })}
                      >
                        {c.header}
                        {active && (sort?.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((row) => {
              const id = rowKey(row);
              return (
                <tr
                  key={id}
                  onClick={() => onRowClick?.(row)}
                  className={cn('transition-colors', onRowClick && 'cursor-pointer hover:bg-surface-2/70', selected?.has(id) && 'bg-accent-soft/50')}
                >
                  {selectable && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected?.has(id) ?? false} onChange={() => toggle(id)} aria-label="Select row" />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        'px-4 py-3 align-middle text-fg',
                        c.align === 'right' && 'text-right tabular',
                        c.align === 'center' && 'text-center',
                        c.hideBelow && hide[c.hideBelow],
                        c.className,
                      )}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {footer}
      {pages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-[13px] text-fg-3">
          <span className="tabular">
            {page * pageSize + 1}–{Math.min(sorted.length, (page + 1) * pageSize)} of {sorted.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="grid size-8 place-items-center rounded-lg hover:bg-surface-2 disabled:opacity-40"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="tabular px-1">
              {page + 1} / {pages}
            </span>
            <button
              type="button"
              className="grid size-8 place-items-center rounded-lg hover:bg-surface-2 disabled:opacity-40"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= pages - 1}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
