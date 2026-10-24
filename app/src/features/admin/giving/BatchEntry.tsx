import { useEffect, useState } from 'react';
import { doc, collection, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Switch, TextField } from '@/components/ui/input';
import { MemberPicker } from '@/components/member-picker';
import { audit, db, getActor } from '@/lib/db';
import { cedis, fmtDate, isoDate } from '@/lib/format';
import { receiptNumber, sum, uid } from '@/lib/utils';
import { useChurch } from '@/lib/settings';
import { sendSms } from '@/features/admin/messages/sms-client';
import type { Member, PaymentMethod } from '@/lib/types';
import { METHODS } from './shared';

interface Row {
  key: string;
  who: { id: string | null; name: string; member?: Member } | null;
  amount: string;
  method: PaymentMethod;
}

const blank = (method: PaymentMethod): Row => ({ key: uid(), who: null, amount: '', method });

/** Enter a stack of tithe envelopes / cards in one sitting. */
export function BatchEntry({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const church = useChurch();
  const [category, setCategory] = useState('Tithe');
  const [date, setDate] = useState(isoDate());
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [rows, setRows] = useState<Row[]>([blank('cash')]);
  const [sms, setSms] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setRows([blank(method), blank(method), blank(method)]);
  }, [open]);

  const valid = rows.filter((r) => r.who && Number(r.amount) > 0);
  const total = sum(valid, (r) => Number(r.amount));
  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function save() {
    if (!valid.length) return;
    setBusy(true);
    try {
      const actor = getActor();
      const b = writeBatch(db);
      const created = valid.map((r) => {
        const g = {
          category,
          amount: Math.round(Number(r.amount) * 100) / 100,
          method: r.method,
          reference: '',
          memberId: r.who!.id,
          memberName: r.who!.name,
          date,
          notes: 'Batch entry',
          receiptNo: receiptNumber(church.shortName || 'CWC', new Date(date)),
          pledgeId: null,
          campaignId: null,
          recordedBy: actor?.uid,
          recordedByName: actor?.name,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: actor?.uid ?? null,
        };
        b.set(doc(collection(db, 'gifts')), g);
        return { g, member: r.who!.member };
      });
      await b.commit();
      void audit('create', 'gifts', undefined, `Batch recorded ${created.length} × ${category}, total ${cedis(total)}`);
      toast.success(`${created.length} gifts recorded · ${cedis(total)}`);

      const smsable = created.filter((c) => c.member?.phone && !c.member.smsOptOut);
      if (sms && smsable.length && church.smsSenderId) {
        // One personalised bulk send — each person gets their own amount and receipt number.
        sendSms({
          senderId: church.smsSenderId,
          audience: `Receipts — ${category} ${fmtDate(date)}`,
          message: `Dear {first_name|Beloved}, we have received your ${category} of GHS {amount} on ${fmtDate(date, 'd MMM yyyy')}. Receipt {receipt}. God bless you. ${church.smsSignature ?? ''}`.trim(),
          recipients: smsable.map((c) => ({ phone: c.member!.phone, fields: { first_name: c.member!.firstName, amount: c.g.amount.toFixed(2), receipt: c.g.receiptNo } })),
        })
          .then(() => toast.success(`SMS receipts sent to ${smsable.length}`))
          .catch((e) => toast.error(`SMS receipts failed: ${e.message}`));
      }
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Batch entry"
      description="Record many envelopes or tithe cards at once."
      size="xl"
      footer={
        <>
          <span className="mr-auto hidden self-center text-sm text-fg-2 sm:block">
            {valid.length} entries · <span className="font-semibold text-fg">{cedis(total)}</span>
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} loading={busy} disabled={!valid.length}>Save {valid.length || ''} entries</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {church.givingCategories.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <TextField label="Date" type="date" value={date} max={isoDate()} onChange={(e) => setDate(e.target.value)} />
        <Field label="Default method">
          <Select value={method} onChange={(e) => { setMethod(e.target.value as PaymentMethod); setRows((rs) => rs.map((r) => (r.amount ? r : { ...r, method: e.target.value as PaymentMethod }))); }}>
            {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
        </Field>
      </div>
      <div className="mt-5 space-y-2">
        <div className="hidden grid-cols-[1fr_130px_150px_36px] gap-2 px-1 text-xs font-medium text-fg-3 sm:grid">
          <span>Member</span><span>Amount (GH₵)</span><span>Method</span><span />
        </div>
        {rows.map((r, i) => (
          <div key={r.key} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-line p-2 sm:grid-cols-[1fr_130px_150px_36px] sm:border-0 sm:p-0">
            <div className="col-span-2 sm:col-span-1">
              <MemberPicker value={r.who} onChange={(v) => update(r.key, { who: v })} allowFreeText placeholder={`Person ${i + 1}`} />
            </div>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={r.amount}
              onChange={(e) => update(r.key, { amount: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (i === rows.length - 1) setRows((rs) => [...rs, blank(method)]);
                }
              }}
              className="tabular"
              aria-label={`Amount for person ${i + 1}`}
            />
            <Select value={r.method} onChange={(e) => update(r.key, { method: e.target.value as PaymentMethod })} aria-label="Method">
              {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
            <button type="button" aria-label="Remove row" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs))} className="grid size-10 place-items-center rounded-lg text-fg-3 hover:bg-surface-2 hover:text-danger sm:size-9">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <Button variant="ghost" size="sm" icon={<Plus />} onClick={() => setRows((rs) => [...rs, blank(method)])}>Add row</Button>
      </div>
      <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        {church.smsSenderId ? (
          <Switch checked={sms} onCheckedChange={setSms} label="Text each giver a receipt" description="One personalised SMS per person, sent in a single batch." />
        ) : <span className="text-xs text-fg-3">Set a Sender ID in Settings to send SMS receipts.</span>}
        <span className="text-sm sm:hidden">{valid.length} entries · <strong>{cedis(total)}</strong></span>
      </div>
    </Modal>
  );
}
