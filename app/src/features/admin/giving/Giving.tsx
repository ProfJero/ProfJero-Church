import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Plus, Download, Printer, Layers, HandCoins, TrendingUp, TrendingDown, Wallet, Search } from 'lucide-react';
import { eachMonthOfInterval, format, parseISO, startOfWeek } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useExpensesSince, useGiftsSince } from '@/lib/queries';
import { cedis, fmtDate } from '@/lib/format';
import { downloadCsv } from '@/lib/files';
import { printDocument, escapeHtml } from '@/lib/print';
import { removeDoc } from '@/lib/db';
import { useChurch } from '@/lib/settings';
import { sum, groupBy } from '@/lib/utils';
import type { Gift } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Stat, Card, CardHeader } from '@/components/ui/card';
import { Select, Input, SearchInput } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState, SkeletonRows } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/dialog';
import { useConfirm } from '@/components/ui/confirm';
import { ChartCard, BarList } from '@/components/charts';
import { GiftForm, printReceipt } from './GiftForm';
import { BatchEntry } from './BatchEntry';
import { Pledges } from './Pledges';
import { Expenses } from './Expenses';
import { PERIODS, periodRange, methodLabel, type PeriodKey } from './shared';

export default function Giving() {
  const { can } = useAuth();
  const church = useChurch();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<PeriodKey>('this_month');
  const [custom, setCustom] = useState(() => periodRange('this_month'));
  const range = periodRange(period, custom);
  const [record, setRecord] = useState(false);
  const [batch, setBatch] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [detail, setDetail] = useState<Gift | null>(null);

  useEffect(() => {
    if (params.get('new') === '1') {
      setRecord(true);
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const giftsQ = useGiftsSince(range.from);
  const expQ = useExpensesSince(range.from);
  const gifts = useMemo(() => giftsQ.data.filter((g) => g.date <= range.to), [giftsQ.data, range.to]);
  const expenses = useMemo(() => expQ.data.filter((e) => e.date <= range.to), [expQ.data, range.to]);

  const income = sum(gifts, (g) => g.amount);
  const tithe = sum(gifts.filter((g) => g.category === 'Tithe'), (g) => g.amount);
  const spent = sum(expenses, (e) => e.amount);
  const tithers = new Set(gifts.filter((g) => g.category === 'Tithe' && g.memberId).map((g) => g.memberId)).size;

  const byCategory = useMemo(
    () => [...groupBy(gifts, (g) => g.category).entries()].map(([label, v]) => ({ label, value: sum(v, (g) => g.amount), hint: `${v.length} gifts` })).sort((a, b) => b.value - a.value),
    [gifts],
  );
  const byMethod = useMemo(
    () => [...groupBy(gifts, (g) => g.method).entries()].map(([m, v]) => ({ label: methodLabel(m), value: sum(v, (g) => g.amount) })).sort((a, b) => b.value - a.value),
    [gifts],
  );
  const series = useMemo(() => {
    const months = eachMonthOfInterval({ start: parseISO(range.from), end: parseISO(range.to) });
    if (months.length <= 1) {
      // Within one month: weekly buckets (Mon–Sun) so mid-week expenses aren't lost
      const week = (d: string) => format(startOfWeek(parseISO(d), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const keys = [...new Set([...gifts.map((g) => week(g.date)), ...expenses.map((e) => week(e.date))])].sort();
      return keys.map((k) => ({
        label: `w/c ${fmtDate(k, 'd MMM')}`,
        income: sum(gifts.filter((g) => week(g.date) === k), (g) => g.amount),
        expenses: sum(expenses.filter((e) => week(e.date) === k), (e) => e.amount),
      }));
    }
    return months.map((m) => {
      const k = format(m, 'yyyy-MM');
      return { label: format(m, months.length > 12 ? 'MMM yy' : 'MMM'), income: sum(gifts.filter((g) => g.date.startsWith(k)), (g) => g.amount), expenses: sum(expenses.filter((e) => e.date.startsWith(k)), (e) => e.amount) };
    });
  }, [gifts, expenses, range.from, range.to]);

  const filtered = gifts.filter((g) => (!cat || g.category === cat) && (!q || `${g.memberName} ${g.receiptNo} ${g.reference}`.toLowerCase().includes(q.toLowerCase())));
  const label = PERIODS.find((p) => p.value === period)?.label ?? '';

  const cols: Column<Gift>[] = [
    { key: 'date', header: 'Date', sort: (g) => g.date, cell: (g) => <span className="whitespace-nowrap">{fmtDate(g.date)}</span> },
    { key: 'name', header: 'Giver', sort: (g) => g.memberName ?? '', cell: (g) => <span className="font-medium">{g.memberName || 'Anonymous'}</span> },
    { key: 'category', header: 'Category', sort: (g) => g.category, cell: (g) => <Badge tone={g.category === 'Tithe' ? 'brand' : 'neutral'}>{g.category}</Badge> },
    { key: 'method', header: 'Method', hideBelow: 'md', cell: (g) => <span className="text-fg-2">{methodLabel(g.method)}</span> },
    { key: 'receipt', header: 'Receipt', hideBelow: 'lg', cell: (g) => <span className="font-mono text-xs text-fg-3">{g.receiptNo}</span> },
    { key: 'amount', header: 'Amount', align: 'right', sort: (g) => g.amount, cell: (g) => <span className="font-medium">{cedis(g.amount)}</span> },
  ];

  function exportCsv() {
    downloadCsv(`cwc-giving-${range.from}-to-${range.to}.csv`, filtered.map((g) => ({ Date: g.date, Receipt: g.receiptNo, Giver: g.memberName, Category: g.category, Method: methodLabel(g.method), Reference: g.reference ?? '', Amount: g.amount.toFixed(2), 'Recorded by': g.recordedByName ?? '' })));
  }

  function printReport() {
    const row = (l: string, v: number) => `<tr><td>${escapeHtml(l)}</td><td class="num">${escapeHtml(cedis(v))}</td></tr>`;
    const expCats = [...groupBy(expenses, (e) => e.category).entries()].map(([c, v]) => ({ c, v: sum(v, (e) => e.amount) })).sort((a, b) => b.v - a.v);
    printDocument(
      `Financial summary ${range.from} to ${range.to}`,
      `<div class="head"><div><h1>${escapeHtml(church.name)}</h1><div class="muted">Financial summary</div></div><div style="text-align:right"><strong>${escapeHtml(fmtDate(range.from))} – ${escapeHtml(fmtDate(range.to))}</strong></div></div>
      <h2>Income by category</h2><table><tbody>${byCategory.map((c) => row(c.label, c.value)).join('')}</tbody><tfoot><tr class="total"><td>Total income</td><td class="num">${escapeHtml(cedis(income))}</td></tr></tfoot></table>
      <h2>Income by payment method</h2><table><tbody>${byMethod.map((c) => row(c.label, c.value)).join('')}</tbody></table>
      <h2>Expenses by category</h2><table><tbody>${expCats.map((c) => row(c.c, c.v)).join('')}</tbody><tfoot><tr class="total"><td>Total expenses</td><td class="num">${escapeHtml(cedis(spent))}</td></tr></tfoot></table>
      <h2>Net position</h2><table><tbody>${row('Income − expenses', income - spent)}</tbody></table>
      <p class="muted" style="margin-top:32px">Prepared by ____________________ &nbsp;&nbsp; Approved by ____________________</p>`,
    );
  }

  async function deleteGift(g: Gift) {
    if (!(await confirm({ title: 'Delete this record?', description: `${g.category} ${cedis(g.amount)} from ${g.memberName}. This can’t be undone.`, danger: true, confirmLabel: 'Delete' }))) return;
    await removeDoc('gifts', g.id, { audit: `Deleted ${g.category} ${cedis(g.amount)} (${g.receiptNo})` });
    toast.success('Deleted');
    setDetail(null);
  }

  return (
    <Page>
      <PageHeader
        title="Giving & finance"
        description="Tithes, offerings, pledges and expenses."
        actions={
          can('giving.manage') && (
            <>
              <Button size="sm" variant="outline" icon={<Layers />} onClick={() => setBatch(true)}>Batch entry</Button>
              <Button size="sm" icon={<Plus />} onClick={() => setRecord(true)}>Record giving</Button>
            </>
          )
        }
      />

      {/* One filter row scopes everything below */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={period} onChange={(e) => setPeriod(e.target.value as PeriodKey)} className="sm:w-44" aria-label="Period">
          {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </Select>
        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <Input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} aria-label="From" />
            <span className="text-fg-3">–</span>
            <Input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} aria-label="To" />
          </div>
        )}
        <span className="text-sm text-fg-3 sm:ml-1">{fmtDate(range.from)} – {fmtDate(range.to)}</span>
        <div className="flex gap-2 sm:ml-auto">
          <Button size="sm" variant="outline" icon={<Printer />} onClick={printReport}>Summary</Button>
          <Button size="sm" variant="outline" icon={<Download />} onClick={exportCsv} disabled={!filtered.length}>CSV</Button>
        </div>
      </div>

      <div className={`grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 ${giftsQ.loading ? 'opacity-60' : ''}`}>
        <Stat label="Total income" value={cedis(income, { compact: true })} hint={label.toLowerCase()} icon={<HandCoins />} tone="gold" loading={giftsQ.loading && !gifts.length} />
        <Stat label="Tithes" value={cedis(tithe, { compact: true })} hint={`${tithers} tithers`} icon={<TrendingUp />} />
        <Stat label="Expenses" value={cedis(spent, { compact: true })} hint={`${expenses.length} payments`} icon={<TrendingDown />} tone="danger" />
        <Stat label="Net" value={cedis(income - spent, { compact: true })} hint="income − expenses" icon={<Wallet />} tone={income - spent >= 0 ? 'success' : 'danger'} />
      </div>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions" count={gifts.length}>Transactions</TabsTrigger>
          <TabsTrigger value="pledges">Pledges & campaigns</TabsTrigger>
          <TabsTrigger value="expenses" count={expenses.length}>Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <ChartCard
            title="Income & expenses"
            description={label}
            data={series}
            xKey="label"
            xLabel="Period"
            kind="bar"
            series={[{ key: 'income', label: 'Income', format: (v) => cedis(v) }, { key: 'expenses', label: 'Expenses', format: (v) => cedis(v) }]}
            height={260}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader title="By category" /><BarList items={byCategory} format={(v) => cedis(v, { compact: true })} /></Card>
            <Card><CardHeader title="By payment method" description="Helps reconcile MoMo and bank statements" /><BarList items={byMethod} format={(v) => cedis(v, { compact: true })} /></Card>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <SearchInput value={q} onChange={setQ} placeholder="Search name, receipt or reference" className="sm:w-80" />
            <Select value={cat} onChange={(e) => setCat(e.target.value)} className="sm:w-48" aria-label="Category">
              <option value="">All categories</option>
              {church.givingCategories.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </div>
          <DataTable
            rows={filtered}
            columns={cols}
            rowKey={(g) => g.id}
            onRowClick={setDetail}
            isLoading={giftsQ.loading}
            loading={<SkeletonRows />}
            defaultSort={{ key: 'date', dir: 'desc' }}
            footer={filtered.length > 0 && <div className="flex justify-between border-t border-line px-4 py-2.5 text-sm"><span className="text-fg-3">{filtered.length} records</span><span className="font-semibold tabular">{cedis(sum(filtered, (g) => g.amount))}</span></div>}
            mobile={(g) => (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{g.memberName || 'Anonymous'}</div>
                  <div className="truncate text-xs text-fg-3">{g.category} · {fmtDate(g.date, 'd MMM')} · {methodLabel(g.method)}</div>
                </div>
                <span className="shrink-0 font-semibold tabular">{cedis(g.amount)}</span>
              </div>
            )}
            empty={<EmptyState icon={gifts.length ? <Search /> : <HandCoins />} title={gifts.length ? 'No matches' : `No giving recorded (${label.toLowerCase()})`} action={!gifts.length && can('giving.manage') && <Button icon={<Plus />} onClick={() => setRecord(true)}>Record giving</Button>} />}
          />
        </TabsContent>

        <TabsContent value="pledges" className="mt-4">
          <Pledges />
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <Expenses expenses={expenses} loading={expQ.loading} />
        </TabsContent>
      </Tabs>

      <GiftForm open={record} onOpenChange={setRecord} />
      <BatchEntry open={batch} onOpenChange={setBatch} />
      <Modal
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        title={detail ? cedis(detail.amount) : ''}
        description={detail ? `${detail.category} · ${detail.receiptNo}` : ''}
        size="sm"
        footer={
          detail && (
            <>
              {can('giving.manage') && <Button variant="ghost" className="text-danger sm:mr-auto" onClick={() => deleteGift(detail)}>Delete</Button>}
              <Button icon={<Printer />} onClick={() => printReceipt(detail, church)}>Print receipt</Button>
            </>
          )
        }
      >
        {detail && (
          <dl className="space-y-2.5 text-sm">
            {[
              ['Giver', detail.memberName || 'Anonymous'],
              ['Date', fmtDate(detail.date, 'EEEE d MMMM yyyy')],
              ['Method', methodLabel(detail.method) + (detail.reference ? ` · ${detail.reference}` : '')],
              ['Recorded by', detail.recordedByName || '—'],
              ['Notes', detail.notes || '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4"><dt className="text-fg-3">{k}</dt><dd className="text-right">{v}</dd></div>
            ))}
          </dl>
        )}
      </Modal>
    </Page>
  );
}
