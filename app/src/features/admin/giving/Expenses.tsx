import { useMemo, useState } from 'react';
import { Plus, Receipt, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { createDoc, getActor, removeDoc } from '@/lib/db';
import { cedis, fmtDate, isoDate } from '@/lib/format';
import { useChurch } from '@/lib/settings';
import { sum } from '@/lib/utils';
import type { Expense, PaymentMethod } from '@/lib/types';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea, TextField } from '@/components/ui/input';
import { ImageUpload } from '@/components/image-upload';
import { BarList } from '@/components/charts';
import { useConfirm } from '@/components/ui/confirm';
import { METHODS, methodLabel } from './shared';

export function Expenses({ expenses, loading }: { expenses: Expense[]; loading: boolean }) {
  const { can } = useAuth();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Expense | null>(null);
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    expenses.forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount));
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  const cols: Column<Expense>[] = [
    { key: 'date', header: 'Date', sort: (e) => e.date, cell: (e) => <span className="whitespace-nowrap">{fmtDate(e.date)}</span> },
    { key: 'category', header: 'Category', sort: (e) => e.category, cell: (e) => <span className="font-medium">{e.category}</span> },
    { key: 'desc', header: 'Description', hideBelow: 'lg', cell: (e) => <span className="line-clamp-1 text-fg-2">{e.description || e.payee || '—'}</span> },
    { key: 'method', header: 'Method', hideBelow: 'md', cell: (e) => <span className="text-fg-2">{methodLabel(e.method)}</span> },
    { key: 'receipt', header: '', cell: (e) => (e.receiptUrl ? <Paperclip className="size-4 text-fg-3" aria-label="Has receipt" /> : null) },
    { key: 'amount', header: 'Amount', align: 'right', sort: (e) => e.amount, cell: (e) => <span className="font-medium">{cedis(e.amount)}</span> },
  ];

  async function del(e: Expense) {
    if (!(await confirm({ title: 'Delete expense?', description: `${e.category} — ${cedis(e.amount)}`, danger: true, confirmLabel: 'Delete' }))) return;
    await removeDoc('expenses', e.id, { audit: `Deleted expense ${e.category} ${cedis(e.amount)}` });
    setDetail(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <DataTable
          rows={expenses}
          columns={cols}
          rowKey={(e) => e.id}
          isLoading={loading}
          onRowClick={setDetail}
          defaultSort={{ key: 'date', dir: 'desc' }}
          footer={expenses.length > 0 && <div className="flex justify-between border-t border-line px-4 py-2.5 text-sm"><span className="text-fg-3">Total</span><span className="font-semibold tabular">{cedis(sum(expenses, (e) => e.amount))}</span></div>}
          mobile={(e) => (
            <div className="flex justify-between gap-3">
              <div className="min-w-0"><div className="truncate font-medium">{e.category}</div><div className="truncate text-xs text-fg-3">{fmtDate(e.date)} · {e.description || e.payee || methodLabel(e.method)}</div></div>
              <span className="shrink-0 font-medium tabular">{cedis(e.amount)}</span>
            </div>
          )}
          empty={<EmptyState icon={<Receipt />} title="No expenses in this period" action={can('expenses.manage') && <Button icon={<Plus />} onClick={() => setOpen(true)}>Record expense</Button>} />}
        />
      </div>
      <Card className="self-start">
        <CardHeader title="By category" action={can('expenses.manage') && <Button size="sm" icon={<Plus />} onClick={() => setOpen(true)}>Expense</Button>} />
        <BarList items={byCat} format={(v) => cedis(v, { compact: true })} empty="No expenses yet." />
      </Card>
      <ExpenseForm open={open} onOpenChange={setOpen} />
      <Modal open={!!detail} onOpenChange={(o) => !o && setDetail(null)} title={detail?.category ?? ''} description={detail ? `${fmtDate(detail.date)} · ${cedis(detail.amount)}` : ''} footer={can('expenses.manage') && detail && <Button variant="danger" onClick={() => del(detail)}>Delete</Button>}>
        {detail && (
          <div className="space-y-3 text-sm">
            <p><span className="text-fg-3">Payee:</span> {detail.payee || '—'}</p>
            <p><span className="text-fg-3">Method:</span> {methodLabel(detail.method)} {detail.reference && `· ${detail.reference}`}</p>
            <p><span className="text-fg-3">Approved by:</span> {detail.approvedBy || '—'}</p>
            <p><span className="text-fg-3">Recorded by:</span> {detail.recordedByName || '—'}</p>
            {detail.description && <p className="whitespace-pre-wrap">{detail.description}</p>}
            {detail.receiptUrl && <a href={detail.receiptUrl} target="_blank" rel="noreferrer"><img src={detail.receiptUrl} alt="Receipt" className="mt-2 max-h-96 rounded-xl border border-line" /></a>}
          </div>
        )}
      </Modal>
    </div>
  );
}

function ExpenseForm({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const church = useChurch();
  const [f, setF] = useState({ category: '', amount: '', payee: '', method: 'cash' as PaymentMethod, date: isoDate(), description: '', reference: '', approvedBy: '', receiptUrl: '' });
  const [busy, setBusy] = useState(false);
  const bind = (k: keyof typeof f) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value })) });
  async function save() {
    const amount = Number(f.amount);
    if (!amount) return toast.error('Enter an amount');
    setBusy(true);
    try {
      const category = f.category || church.expenseCategories[0];
      await createDoc('expenses', { ...f, category, amount, recordedBy: getActor()?.uid, recordedByName: getActor()?.name }, { audit: `Expense ${category} ${cedis(amount)}` });
      toast.success('Expense recorded');
      setF({ ...f, amount: '', payee: '', description: '', reference: '', receiptUrl: '' });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Record expense" footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select {...bind('category')}>{church.expenseCategories.map((c) => <option key={c}>{c}</option>)}</Select>
          </Field>
          <Field label="Amount (GH₵)"><Input type="number" inputMode="decimal" {...bind('amount')} className="tabular" /></Field>
          <TextField label="Paid to" {...bind('payee')} />
          <TextField label="Date" type="date" {...bind('date')} />
          <Field label="Method"><Select {...bind('method')}>{METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select></Field>
          <TextField label="Reference" {...bind('reference')} />
        </div>
        <TextField label="Approved by" {...bind('approvedBy')} />
        <Field label="Description"><Textarea rows={2} {...bind('description')} /></Field>
        <Field label="Receipt / invoice photo"><ImageUpload value={f.receiptUrl} onChange={(v) => setF((s) => ({ ...s, receiptUrl: v }))} folder="receipts" aspect="aspect-[4/3]" label="Attach receipt" /></Field>
      </div>
    </Modal>
  );
}
