import { useMemo, useState } from 'react';
import { Plus, Target, Send, HandCoins } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useCampaigns, usePledges, useGiftsSince } from '@/lib/queries';
import { createDoc, patchDoc } from '@/lib/db';
import { cedis, fmtDate, isoDate, pct } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { sum } from '@/lib/utils';
import type { Campaign, Member } from '@/lib/types';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Meter } from '@/components/charts';
import { DataTable, type Column } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea, TextField, Switch } from '@/components/ui/input';
import { MemberPicker } from '@/components/member-picker';
import type { Pledge } from '@/lib/types';
import { SMS_SELECTION_KEY } from '../people/People';

export function Pledges() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { data: campaigns } = useCampaigns();
  const { data: pledges, loading } = usePledges();
  const { data: gifts } = useGiftsSince('2000-01-01', campaigns.length > 0);
  const [campaignId, setCampaignId] = useState('');
  const [newCampaign, setNewCampaign] = useState<Campaign | null | 'new'>(null);
  const [newPledge, setNewPledge] = useState(false);

  const raised = useMemo(() => {
    const m = new Map<string, number>();
    gifts.forEach((g) => g.campaignId && m.set(g.campaignId, (m.get(g.campaignId) ?? 0) + g.amount));
    return m;
  }, [gifts]);

  const list = pledges.filter((p) => !campaignId || p.campaignId === campaignId);
  const manage = can('giving.manage');

  const cols: Column<Pledge>[] = [
    { key: 'name', header: 'Name', sort: (p) => p.memberName, cell: (p) => <span className="font-medium">{p.memberName}</span> },
    { key: 'campaign', header: 'Campaign', hideBelow: 'md', cell: (p) => <span className="text-fg-2">{p.campaignName}</span> },
    { key: 'amount', header: 'Pledged', align: 'right', sort: (p) => p.amount, cell: (p) => cedis(p.amount) },
    { key: 'paid', header: 'Paid', align: 'right', sort: (p) => p.paid, cell: (p) => cedis(p.paid) },
    { key: 'balance', header: 'Balance', align: 'right', sort: (p) => p.amount - p.paid, cell: (p) => (p.paid >= p.amount ? <Badge tone="success">Fulfilled</Badge> : cedis(p.amount - p.paid)) },
    { key: 'progress', header: '', hideBelow: 'lg', className: 'w-36', cell: (p) => <Meter value={p.paid} max={p.amount} /> },
  ];

  function remind() {
    const open = list.filter((p) => p.paid < p.amount && p.memberId);
    sessionStorage.setItem('cwc-sms-pledges', JSON.stringify(open.map((p) => ({ memberId: p.memberId, balance: (p.amount - p.paid).toFixed(2), campaign: p.campaignName }))));
    sessionStorage.setItem(SMS_SELECTION_KEY, JSON.stringify(open.map((p) => p.memberId)));
    navigate('/admin/messages?compose=1&audience=selection&label=Pledge%20balances&template=pledge');
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {campaigns.map((c) => {
          const cp = pledges.filter((p) => p.campaignId === c.id);
          const total = (raised.get(c.id) ?? 0);
          return (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-[15px] font-semibold">{c.name}</h3>
                  <p className="text-xs text-fg-3">{c.endDate ? `Ends ${fmtDate(c.endDate)}` : 'Ongoing'}</p>
                </div>
                {c.isActive ? <Badge tone="success" dot>Active</Badge> : <Badge>Closed</Badge>}
              </div>
              <div className="mt-4 flex items-baseline justify-between gap-2">
                <span className="text-xl font-semibold">{cedis(total, { compact: true })}</span>
                <span className="text-xs text-fg-3">of {cedis(c.goal, { compact: true })} · {pct(c.goal ? total / c.goal : 0)}</span>
              </div>
              <Meter value={total} max={c.goal} className="mt-2" />
              <div className="mt-3 flex justify-between text-xs text-fg-3">
                <span>{cp.length} pledges · {cedis(sum(cp, (p) => p.amount), { compact: true })} pledged</span>
                {manage && <button className="font-medium text-accent hover:underline dark:text-brand-300" onClick={() => setNewCampaign(c)}>Edit</button>}
              </div>
            </Card>
          );
        })}
        {manage && (
          <button onClick={() => setNewCampaign('new')} className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong text-sm font-medium text-fg-3 hover:border-brand-400 hover:text-fg-2">
            <Target className="size-5" /> New campaign
          </button>
        )}
      </div>

      <Card>
        <CardHeader
          title="Pledges"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="h-8 w-44 text-xs" aria-label="Campaign">
                <option value="">All campaigns</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              {can('messaging.sms') && <Button size="sm" variant="outline" icon={<Send />} onClick={remind}>Remind</Button>}
              {manage && <Button size="sm" icon={<Plus />} onClick={() => setNewPledge(true)} disabled={!campaigns.length}>Pledge</Button>}
            </div>
          }
        />
        <DataTable
          className="rounded-none border-0 border-t shadow-none"
          rows={list}
          columns={cols}
          rowKey={(p) => p.id}
          isLoading={loading}
          defaultSort={{ key: 'balance', dir: 'desc' }}
          mobile={(p) => (
            <div>
              <div className="flex justify-between gap-2"><span className="truncate font-medium">{p.memberName}</span><span className="shrink-0 text-sm tabular">{cedis(p.paid)} / {cedis(p.amount)}</span></div>
              <div className="mt-0.5 text-xs text-fg-3">{p.campaignName}{p.phone ? ` · ${formatPhone(p.phone)}` : ''}</div>
              <Meter value={p.paid} max={p.amount} className="mt-2" />
            </div>
          )}
          empty={<EmptyState compact icon={<HandCoins />} title="No pledges yet" description={campaigns.length ? 'Record pledges made towards a campaign.' : 'Create a campaign first (e.g. building project, harvest).'} />}
        />
      </Card>
      <CampaignForm value={newCampaign} onClose={() => setNewCampaign(null)} />
      <PledgeForm open={newPledge} onOpenChange={setNewPledge} campaigns={campaigns} />
    </div>
  );
}

function CampaignForm({ value, onClose }: { value: Campaign | null | 'new'; onClose: () => void }) {
  const editing = value && value !== 'new' ? value : null;
  const [f, setF] = useState({ name: '', goal: '', description: '', startDate: isoDate(), endDate: '', isActive: true });
  const [busy, setBusy] = useState(false);
  const key = value === 'new' ? 'new' : editing?.id;
  const [lastKey, setLastKey] = useState<string | undefined>();
  if (key !== lastKey) {
    setLastKey(key);
    if (editing) setF({ name: editing.name, goal: String(editing.goal), description: editing.description ?? '', startDate: editing.startDate ?? '', endDate: editing.endDate ?? '', isActive: editing.isActive });
    else if (value === 'new') setF({ name: '', goal: '', description: '', startDate: isoDate(), endDate: '', isActive: true });
  }
  async function save() {
    if (!f.name.trim() || !Number(f.goal)) return toast.error('Name and goal are required');
    setBusy(true);
    const data = { ...f, name: f.name.trim(), goal: Number(f.goal) };
    try {
      if (editing) await patchDoc('campaigns', editing.id, data, { audit: `Updated campaign ${data.name}` });
      else await createDoc('campaigns', data, { audit: `Created campaign ${data.name}` });
      onClose();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={!!value} onOpenChange={(o) => !o && onClose()} title={editing ? 'Edit campaign' : 'New campaign'} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="space-y-4">
        <TextField label="Name" placeholder="e.g. Sanctuary Building Project" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Field label="Goal (GH₵)"><Input type="number" inputMode="decimal" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Starts" type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
          <TextField label="Ends" type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
        </div>
        <Field label="Description"><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Switch checked={f.isActive} onCheckedChange={(v) => setF({ ...f, isActive: v })} label="Accepting gifts & pledges" />
      </div>
    </Modal>
  );
}

function PledgeForm({ open, onOpenChange, campaigns }: { open: boolean; onOpenChange: (o: boolean) => void; campaigns: Campaign[] }) {
  const [who, setWho] = useState<{ id: string | null; name: string; member?: Member } | null>(null);
  const [campaignId, setCampaignId] = useState('');
  const [amount, setAmount] = useState('');
  const [paid, setPaid] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    const c = campaigns.find((x) => x.id === (campaignId || campaigns[0]?.id));
    if (!who || !c || !Number(amount)) return toast.error('Choose a person, campaign and amount');
    setBusy(true);
    try {
      await createDoc('pledges', { campaignId: c.id, campaignName: c.name, memberId: who.id, memberName: who.name, phone: who.member?.phone ?? '', amount: Number(amount), paid: Number(paid) || 0, dueDate }, { audit: `Pledge ${cedis(Number(amount))} by ${who.name}` });
      toast.success('Pledge recorded');
      setWho(null);
      setAmount('');
      setPaid('');
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Record a pledge" footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Person"><MemberPicker value={who} onChange={setWho} allowFreeText /></Field>
        <Field label="Campaign">
          <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            {campaigns.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pledged (GH₵)"><Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Already paid"><Input type="number" inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="0" /></Field>
        </div>
        <TextField label="Redeem by" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <p className="text-xs text-fg-3">Record later payments with “Record giving” → category “Pledge Redemption”; the balance updates automatically.</p>
      </div>
    </Modal>
  );
}
