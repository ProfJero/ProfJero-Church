import { useState, type ReactNode } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps,
} from 'recharts';
import { Table2, LineChart as LineIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CardHeader } from './ui/card';

/**
 * Chart conventions (see dataviz guidance): one colour for a single series and
 * no legend; legend + line keys for 2+; thin marks, solid hairline grid,
 * crosshair tooltip; every chart has a table view.
 */
export interface SeriesDef {
  key: string;
  label: string;
  color?: string; // CSS colour; defaults to the slot order
  format?: (v: number) => string;
}

const SLOT = ['var(--color-series-1)', 'var(--color-series-2)', 'var(--color-series-3)'];
const compact = new Intl.NumberFormat('en-GH', { notation: 'compact', maximumFractionDigits: 1 });
const axisTick = { fill: 'var(--color-fg-3)', fontSize: 11 };

function ChartTooltip({ active, payload, label, series }: TooltipProps<number, string> & { series: SeriesDef[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-[var(--shadow-pop)]">
      <div className="mb-1.5 font-medium text-fg-3">{label}</div>
      {series.map((s, i) => {
        const v = payload.find((p) => p.dataKey === s.key)?.value as number | undefined;
        return (
          <div key={s.key} className="flex items-center gap-2 py-0.5">
            <span className="h-0.5 w-3 rounded-full" style={{ background: s.color ?? SLOT[i] }} />
            <span className="flex-1 text-fg-3">{s.label}</span>
            <span className="font-semibold tabular text-fg">{v == null ? '—' : s.format ? s.format(v) : v.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}

function Legend({ series, kind }: { series: SeriesDef[]; kind: 'line' | 'bar' }) {
  if (series.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 pb-1 text-xs text-fg-2">
      {series.map((s, i) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className={kind === 'line' ? 'h-0.5 w-3.5 rounded-full' : 'size-2.5 rounded-[3px]'} style={{ background: s.color ?? SLOT[i] }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function DataTableView<T extends Record<string, unknown>>({ data, xKey, xLabel, series }: { data: T[]; xKey: string; xLabel: string; series: SeriesDef[] }) {
  return (
    <div className="max-h-72 overflow-auto px-5 pb-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-fg-3">
            <th className="py-2 pr-3 font-medium">{xLabel}</th>
            {series.map((s) => (
              <th key={s.key} className="py-2 pl-3 text-right font-medium">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.map((row, i) => (
            <tr key={i}>
              <td className="py-1.5 pr-3 text-fg-2">{String(row[xKey])}</td>
              {series.map((s) => {
                const v = Number(row[s.key] ?? 0);
                return (
                  <td key={s.key} className="py-1.5 pl-3 text-right tabular">
                    {s.format ? s.format(v) : v.toLocaleString()}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChartCard<T extends Record<string, unknown>>({
  title,
  description,
  action,
  data,
  xKey,
  xLabel = 'Period',
  series,
  kind = 'area',
  height = 240,
  className,
  empty,
  yFormat,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  data: T[];
  xKey: string;
  xLabel?: string;
  series: SeriesDef[];
  kind?: 'area' | 'line' | 'bar';
  height?: number;
  className?: string;
  empty?: ReactNode;
  yFormat?: (v: number) => string;
}) {
  const [table, setTable] = useState(false);
  const hasData = data.some((d) => series.some((s) => Number(d[s.key]) > 0));
  const toggle = (
    <button
      type="button"
      onClick={() => setTable((t) => !t)}
      className="grid size-8 place-items-center rounded-lg text-fg-3 hover:bg-surface-2 hover:text-fg"
      aria-label={table ? 'Show chart' : 'Show as table'}
      title={table ? 'Show chart' : 'Show as table'}
    >
      {table ? <LineIcon className="size-4" /> : <Table2 className="size-4" />}
    </button>
  );
  return (
    <div className={cn('card flex flex-col', className)}>
      <CardHeader
        title={title}
        description={description}
        action={
          <div className="flex items-center gap-1">
            {action}
            {hasData && toggle}
          </div>
        }
      />
      {!hasData ? (
        <div className="grid flex-1 place-items-center px-5 pb-6 text-sm text-fg-3" style={{ minHeight: height }}>
          {empty ?? 'No data for this period yet.'}
        </div>
      ) : table ? (
        <DataTableView data={data} xKey={xKey} xLabel={xLabel} series={series} />
      ) : (
        <>
          <Legend series={series} kind={kind === 'bar' ? 'bar' : 'line'} />
          <div className="px-2 pb-3" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              {renderChart(kind, data, xKey, series, yFormat)}
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

function renderChart<T>(kind: 'area' | 'line' | 'bar', data: T[], xKey: string, series: SeriesDef[], yFormat?: (v: number) => string) {
  const common = { data: data as Record<string, unknown>[], margin: { top: 8, right: 12, left: 0, bottom: 0 } };
  const grid = <CartesianGrid vertical={false} stroke="var(--color-grid)" strokeWidth={1} />;
  const x = <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--color-axis)' }} minTickGap={16} tickMargin={8} />;
  const y = (
    <YAxis
      tick={axisTick}
      tickLine={false}
      axisLine={false}
      width={44}
      allowDecimals={false}
      tickFormatter={(v: number) => (yFormat ? yFormat(v) : v >= 1000 ? compact.format(v) : String(v))}
    />
  );
  const tooltip = (
    <Tooltip
      content={<ChartTooltip series={series} />}
      cursor={kind === 'bar' ? { fill: 'var(--color-surface-2)' } : { stroke: 'var(--color-line-strong)', strokeWidth: 1 }}
    />
  );
  if (kind === 'bar') {
    return (
      <BarChart {...common} barGap={2} barCategoryGap="28%">
        {grid}
        {x}
        {y}
        {tooltip}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? SLOT[i]} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        ))}
      </BarChart>
    );
  }
  if (kind === 'line') {
    return (
      <LineChart {...common}>
        {grid}
        {x}
        {y}
        {tooltip}
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? SLOT[i]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 4.5, strokeWidth: 2, stroke: 'var(--color-surface)' }}
          />
        ))}
      </LineChart>
    );
  }
  return (
    <AreaChart {...common}>
      {grid}
      {x}
      {y}
      {tooltip}
      {series.map((s, i) => (
        <Area
          key={s.key}
          type="monotone"
          dataKey={s.key}
          name={s.label}
          stroke={s.color ?? SLOT[i]}
          strokeWidth={2}
          fill={s.color ?? SLOT[i]}
          fillOpacity={0.1}
          dot={false}
          isAnimationActive={false}
          activeDot={{ r: 4.5, strokeWidth: 2, stroke: 'var(--color-surface)' }}
        />
      ))}
    </AreaChart>
  );
}

/** Horizontal ranked bars in plain HTML — a better fit than a donut for category shares. */
export function BarList({ items, format, empty = 'Nothing to show yet.' }: { items: { label: string; value: number; hint?: string }[]; format: (v: number) => string; empty?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="px-5 pb-5 text-sm text-fg-3">{empty}</p>;
  return (
    <ul className="space-y-3 px-5 pb-5">
      {items.map((it) => (
        <li key={it.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-fg-2">{it.label}</span>
            <span className="shrink-0 font-medium tabular text-fg">{format(it.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-[var(--color-series-1)]" style={{ width: `${(it.value / max) * 100}%` }} />
          </div>
          {it.hint && <div className="mt-0.5 text-xs text-fg-3">{it.hint}</div>}
        </li>
      ))}
    </ul>
  );
}

/** Progress meter; track is a lighter step of the same hue. */
export function Meter({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-brand-100 dark:bg-brand-500/15', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-[var(--color-series-1)] transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}
