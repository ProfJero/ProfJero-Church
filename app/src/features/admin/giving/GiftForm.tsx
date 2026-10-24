import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { increment } from 'firebase/firestore';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea, TextField, Switch } from '@/components/ui/input';
import { MemberPicker } from '@/components/member-picker';
import { createDoc, getActor, patchDoc } from '@/lib/db';
import { cedis, fmtDate, isoDate } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { receiptNumber } from '@/lib/utils';
import { useChurch } from '@/lib/settings';
import { useCampaigns, usePledges } from '@/lib/queries';
import { printDocument, escapeHtml } from '@/lib/print';
import { sendSms } from '@/features/admin/messages/sms-client';
import type { ChurchSettings, Gift, Member, PaymentMethod } from '@/lib/types';
import { METHODS, methodLabel } from './shared';

export function printReceipt(g: Pick<Gift, 'receiptNo' | 'amount' | 'category' | 'method' | 'date' | 'memberName' | 'reference' | 'recordedByName'>, church: ChurchSettings) {
  printDocument(
    `Receipt ${g.receiptNo}`,
    `<div style="max-width:420px;margin:0 auto">
      <div class="head"><div><h1>${escapeHtml(church.name)}</h1><div class="muted">${escapeHtml([church.address, church.phone && formatPhone(church.phone)].filter(Boolean).join(' · '))}</div></div></div>
      <h2 style="margin-top:0">Official receipt</h2>
      <table>
        <tr><th>Receipt no.</th><td class="num">${escapeHtml(g.receiptNo)}</td></tr>
        <tr><th>Date</th><td class="num">${escapeHtml(fmtDate(g.date))}</td></tr>
        <tr><th>Received from</th><td class="num">${escapeHtml(g.memberName || 'Anonymous')}</td></tr>
        <tr><th>Being</th><td class="num">${escapeHtml(g.category)}</td></tr>
        <tr><th>Payment</th><td class="num">${escapeHtml(methodLabel(g.method))}${g.reference ? ` · ${escapeHtml(g.reference)}` : ''}</td></tr>
        <tr class="total"><td>Amount</td><td class="num">${escapeHtml(cedis(g.amount))}</td></tr>
      </table>
      <p class="muted" style="margin-top:20px">Received by ${escapeHtml(g.recordedByName || '—')}. Thank you and God bless you.</p>
    </div>`,
  );
}

export function GiftForm({ open, onOpenChange, presetMember }: { open: boolean; onOpenChange: (o: boolean) => void; presetMember?: { id: string; name: string; member?: Member } | null }) {
  const church = useChurch();
  const { data: pledges } = usePledges(open);
  const { data: campaigns } = useCampaigns(open);
  const [who, setWho] = useState<{ id: string | null; name: string; member?: Member } | null>(null);
  const [category, setCategory] = useState('Tithe');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(isoDate());
  const [notes, setNotes] = useState('');
  const [pledgeId, setPledgeId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [smsReceipt, setSmsReceipt] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWho(presetMember ?? null);
    setAmount('');
    setReference('');
    setNotes('');
    setPledgeId('');
    setCampaignId('');
  }, [open, presetMember]);

  const memberPledges = pledges.filter((p) => who?.id && p.memberId === who.id && p.paid < p.amount);
  const isPledge = category === 'Pledge Redemption';

  async function save(andNew = false) {
    const value = Number(amount);
    if (!value || value <= 0) return toast.error('Enter an amount');
    setBusy(true);
    try {
      const pledge = memberPledges.find((p) => p.id === pledgeId);
      const gift = {
        category,
        amount: Math.round(value * 100) / 100,
        method,
        reference: reference.trim(),
        memberId: who?.id ?? null,
        memberName: who?.name ?? 'Anonymous',
        date,
        notes: notes.trim(),
        receiptNo: receiptNumber(church.shortName || 'CWC', new Date(date)),
        pledgeId: pledge?.id ?? null,
        campaignId: pledge?.campaignId ?? (campaignId || null),
        recordedBy: getActor()?.uid,
        recordedByName: getActor()?.name,
      };
      await createDoc('gifts', gift, { audit: `Recorded ${gift.category} ${cedis(gift.amount)} from ${gift.memberName}` });
      if (pledge) await patchDoc('pledges', pledge.id, { paid: increment(gift.amount) });
      toast.success(`${cedis(gift.amount)} recorded · ${gift.receiptNo}`, { action: { label: 'Print receipt', onClick: () => printReceipt(gift, church) } });

      const phone = who?.member?.phone;
      if (smsReceipt && phone && church.smsSenderId && !who?.member?.smsOptOut) {
        sendSms({
          senderId: church.smsSenderId,
          audience: `Receipt ${gift.receiptNo}`,
          message: `Dear {first_name|Beloved}, we have received your ${gift.category} of GHS ${gift.amount.toFixed(2)} on ${fmtDate(gift.date, 'd MMM yyyy')}. Receipt ${gift.receiptNo}. Thank you and God bless you. ${church.smsSignature ?? ''}`.trim(),
          recipients: [{ phone, fields: { first_name: who?.member?.firstName ?? '' } }],
          idempotencyKey: `receipt-${gift.receiptNo}`,
        }).catch((e) => toast.error(`Receipt SMS failed: ${e.message}`));
      }
      if (andNew) {
        setWho(null);
        setAmount('');
        setReference('');
        setNotes('');
      } else onOpenChange(false);
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
      title="Record giving"
      description="Tithes, offerings, seeds and pledge payments."
      footer={
        <>
          <Button variant="outline" onClick={() => save(true)} loading={busy} className="sm:mr-auto">Save & add another</Button>
          <Button onClick={() => save(false)} loading={busy}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Giver" hint="Leave empty for loose/anonymous offerings.">
          <MemberPicker value={who} onChange={setWho} allowFreeText placeholder="Search member, or type a name" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {church.givingCategories.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Amount (GH₵)">
            <Input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="text-lg font-semibold tabular" />
          </Field>
        </div>
        {isPledge && who?.id && (
          <Field label="Towards pledge">
            <Select value={pledgeId} onChange={(e) => setPledgeId(e.target.value)}>
              <option value="">{memberPledges.length ? 'Choose pledge…' : 'No open pledges for this person'}</option>
              {memberPledges.map((p) => <option key={p.id} value={p.id}>{p.campaignName} — balance {cedis(p.amount - p.paid)}</option>)}
            </Select>
          </Field>
        )}
        {!isPledge && campaigns.some((c) => c.isActive) && (
          <Field label="Campaign (optional)">
            <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">None</option>
              {campaigns.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Method">
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          </Field>
          <TextField label="Date" type="date" value={date} max={isoDate()} onChange={(e) => setDate(e.target.value)} />
        </div>
        {method !== 'cash' && <TextField label={method === 'momo' ? 'MoMo transaction ID' : 'Reference'} value={reference} onChange={(e) => setReference(e.target.value)} />}
        <Field label="Notes (optional)">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {who?.member?.phone && church.smsSenderId && (
          <Switch checked={smsReceipt} onCheckedChange={setSmsReceipt} label="Send SMS receipt" description={`To ${formatPhone(who.member.phone)}`} />
        )}
      </div>
    </Modal>
  );
}
