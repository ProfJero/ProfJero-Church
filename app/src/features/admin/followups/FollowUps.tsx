import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Phone, MessageCircle, Plus, CalendarClock, Route, Send, ChevronRight, Trash2 } from 'lucide-react';
import { arrayUnion } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useFollowUps, useUsers } from '@/lib/queries';
import { createDoc, getActor, patchDoc, removeDoc } from '@/lib/db';
import { formatPhone, telHref, whatsappHref } from '@/lib/phone';
import { fmtDate, isoDate, relative, friendlyDay } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useIsDesktop } from '@/lib/hooks';
import { isStaff } from '@/lib/permissions';
import type { FollowUp, FollowUpKind, FollowUpStage } from '@/lib/types';
import { Page, PageHeader, Toolbar } from '@/components/ui/page';
import { Button, buttonClass } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Segmented } from '@/components/ui/tabs';
import { Modal } from '@/components/ui/dialog';
import { Field, Select, Textarea, TextField } from '@/components/ui/input';
import { MemberPicker } from '@/components/member-picker';
import { EmptyState, SkeletonRows } from '@/components/ui/feedback';
import { useConfirm } from '@/components/ui/confirm';
import { SMS_SELECTION_KEY } from '../people/People';
import { useNavigate } from 'react-router';

export const STAGES: { value: FollowUpStage; label: string; hint: string }[] = [
  { value: 'new', label: 'New', hint: 'Not contacted yet' },
  { value: 'contacted', label: 'Contacted', hint: 'Called or messaged' },
  { value: 'visited', label: 'Visited', hint: 'Met in person' },
  { value: 'integrated', label: 'Integrated', hint: 'Joined a group / settled' },
];

const KIND: Record<FollowUpKind, { label: string; tone: 'gold' | 'info' | 'warning' | 'brand' | 'neutral' }> = {
  first_timer: { label: 'First-timer', tone: 'gold' },
  new_convert: { label: 'New convert', tone: 'info' },
  absentee: { label: 'Absentee', tone: 'warning' },
  pastoral: { label: 'Pastoral', tone: 'brand' },
  general: { label: 'General', tone: 'neutral' },
};

export default function FollowUps() {
  const { data, loading } = useFollowUps();
  const desktop = useIsDesktop();
  const [kind, setKind] = useState<'all' | FollowUpKind>('all');
  const [mine, setMine] = useState(false);
  const [stage, setStage] = useState<FollowUpStage>('new');
  const [openId, setOpenId] = useState<string | null>(null);
  const [create, setCreate] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const { user } = useAuth();

  const list = useMemo(
    () => data.filter((f) => f.stage !== 'closed' && (kind === 'all' || f.kind === kind) && (!mine || f.assignedTo === user?.uid)),
    [data, kind, mine, user],
  );
  const byStage = (s: FollowUpStage) => list.filter((f) => f.stage === s).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  const open = data.find((f) => f.id === openId) ?? null;

  async function move(id: string, to: FollowUpStage) {
    const f = data.find((x) => x.id === id);
    if (!f || f.stage === to) return;
    await patchDoc('followups', id, { stage: to, notes: arrayUnion({ text: `Moved to ${STAGES.find((s) => s.value === to)?.label}`, by: getActor()?.name ?? '', at: Date.now() }) });
  }

  return (
    <Page width="wide">
      <PageHeader
        title="Follow-ups"
        description="Make sure every first-timer, new convert and absent member is cared for."
        actions={<Button size="sm" icon={<Plus />} onClick={() => setCreate(true)}>New follow-up</Button>}
      />
      <Toolbar>
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'all', label: 'All' },
            { value: 'first_timer', label: 'First-timers' },
            { value: 'new_convert', label: 'Converts' },
            { value: 'absentee', label: 'Absentees' },
            { value: 'pastoral', label: 'Pastoral' },
          ]}
        />
        <label className="flex items-center gap-2 text-sm text-fg-2 sm:ml-2">
          <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={mine} onChange={(e) => setMine(e.target.checked)} />
          Assigned to me
        </label>
      </Toolbar>

      {loading ? (
        <div className="card"><SkeletonRows /></div>
      ) : desktop ? (
        <div className="grid grid-cols-4 gap-4">
          {STAGES.map((s) => {
            const items = byStage(s.value);
            return (
              <section
                key={s.value}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dragId && move(dragId, s.value)}
                className="flex min-h-[60dvh] flex-col rounded-2xl bg-surface-2/70 p-2 dark:bg-surface/50"
              >
                <header className="flex items-center justify-between px-2 pb-2 pt-1">
                  <div>
                    <h2 className="text-[13px] font-semibold">{s.label} <span className="ml-1 font-normal text-fg-3">{items.length}</span></h2>
                    <p className="text-[11px] text-fg-3">{s.hint}</p>
                  </div>
                </header>
                <div className="space-y-2">
                  {items.map((f) => (
                    <FollowUpCard key={f.id} f={f} onOpen={() => setOpenId(f.id)} draggable onDragStart={() => setDragId(f.id)} />
                  ))}
                  {items.length === 0 && <p className="rounded-xl border border-dashed border-line-strong px-3 py-6 text-center text-xs text-fg-3">Drop cards here</p>}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <>
          <Segmented
            className="mb-3 w-full"
            value={stage}
            onChange={setStage}
            options={STAGES.map((s) => ({ value: s.value, label: `${s.label} · ${byStage(s.value).length}` }))}
          />
          {byStage(stage).length === 0 ? (
            <div className="card"><EmptyState compact icon={<Route />} title={`Nothing in “${STAGES.find((s) => s.value === stage)?.label}”`} /></div>
          ) : (
            <div className="space-y-2">
              {byStage(stage).map((f) => <FollowUpCard key={f.id} f={f} onOpen={() => setOpenId(f.id)} />)}
            </div>
          )}
        </>
      )}

      <FollowUpSheet f={open} onClose={() => setOpenId(null)} onMove={move} />
      <NewFollowUp open={create} onOpenChange={setCreate} />
    </Page>
  );
}

function FollowUpCard({ f, onOpen, ...drag }: { f: FollowUp; onOpen: () => void; draggable?: boolean; onDragStart?: () => void }) {
  const overdue = f.dueDate && f.dueDate < isoDate();
  return (
    <button
      type="button"
      onClick={onOpen}
      {...drag}
      className="card block w-full p-3 text-left transition-shadow hover:shadow-[var(--shadow-pop)] active:cursor-grabbing"
    >
      <div className="flex items-center gap-2.5">
        <Avatar name={f.name} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{f.name}</div>
          <div className="truncate text-xs text-fg-3">{formatPhone(f.phone) || 'No phone'}</div>
        </div>
        <ChevronRight className="size-4 text-fg-3 lg:hidden" />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Badge tone={KIND[f.kind]?.tone}>{KIND[f.kind]?.label}</Badge>
        {f.dueDate && (
          <span className={cn('inline-flex items-center gap-1 text-[11px]', overdue ? 'font-medium text-danger' : 'text-fg-3')}>
            <CalendarClock className="size-3" /> {overdue ? 'Overdue' : friendlyDay(f.dueDate)}
          </span>
        )}
        {f.assignedName && <span className="ml-auto truncate text-[11px] text-fg-3">→ {f.assignedName}</span>}
      </div>
    </button>
  );
}

function FollowUpSheet({ f, onClose, onMove }: { f: FollowUp | null; onClose: () => void; onMove: (id: string, s: FollowUpStage) => void }) {
  const { data: users } = useUsers();
  const { can } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [note, setNote] = useState('');
  const staff = users.filter((u) => isStaff(u.role) && u.isActive !== false);
  if (!f) return null;

  async function addNote() {
    if (!note.trim() || !f) return;
    await patchDoc('followups', f.id, { notes: arrayUnion({ text: note.trim(), by: getActor()?.name ?? '', at: Date.now() }) });
    setNote('');
  }
  async function assign(uid: string) {
    const u = staff.find((x) => x.uid === uid || x.id === uid);
    await patchDoc('followups', f!.id, { assignedTo: uid || null, assignedName: u?.fullName ?? '' });
    toast.success(u ? `Assigned to ${u.fullName}` : 'Unassigned');
  }
  async function close() {
    await patchDoc('followups', f!.id, { stage: 'closed' });
    toast.success('Follow-up closed');
    onClose();
  }
  async function del() {
    if (!(await confirm({ title: 'Delete this follow-up?', danger: true, confirmLabel: 'Delete' }))) return;
    await removeDoc('followups', f!.id);
    onClose();
  }

  return (
    <Modal open={!!f} onOpenChange={(o) => !o && onClose()} title={f.name} description={`${KIND[f.kind]?.label} · added ${relative(f.createdAt)}`} side>
      <div className="space-y-6">
        {f.phone && (
          <div className="flex flex-wrap gap-2">
            <a href={telHref(f.phone)} className={buttonClass('outline', 'sm')}><Phone /> Call</a>
            <a href={whatsappHref(f.phone, `Hello ${f.name.split(' ')[0]}, `)} target="_blank" rel="noreferrer" className={buttonClass('outline', 'sm')}><MessageCircle /> WhatsApp</a>
            {can('messaging.sms') && f.memberId && (
              <Button size="sm" variant="outline" icon={<Send />} onClick={() => { sessionStorage.setItem(SMS_SELECTION_KEY, JSON.stringify([f.memberId])); navigate('/admin/messages?compose=1&audience=selection'); }}>SMS</Button>
            )}
            {f.memberId && <Link to={`/admin/people/${f.memberId}`} className={buttonClass('ghost', 'sm')}>View profile</Link>}
          </div>
        )}
        <Field label="Stage">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STAGES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => onMove(f.id, s.value)}
                className={cn('h-9 rounded-lg border text-[13px] font-medium', f.stage === s.value ? 'border-transparent bg-accent text-accent-fg' : 'border-line-strong text-fg-2 hover:bg-surface-2')}
              >
                {s.label}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Assigned to">
            <Select value={f.assignedTo ?? ''} onChange={(e) => assign(e.target.value)}>
              <option value="">Unassigned</option>
              {staff.map((u) => <option key={u.id} value={u.uid || u.id}>{u.fullName}</option>)}
            </Select>
          </Field>
          <TextField label="Due" type="date" value={f.dueDate ?? ''} onChange={(e) => patchDoc('followups', f.id, { dueDate: e.target.value })} />
        </div>
        <div>
          <h3 className="mb-2 text-[13px] font-medium text-fg-2">Notes</h3>
          <div className="flex gap-2">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened? e.g. Called — will come on Sunday" className="min-h-0" />
            <Button onClick={addNote} disabled={!note.trim()} className="self-end">Add</Button>
          </div>
          <ol className="mt-4 space-y-3">
            {[...(f.notes ?? [])].reverse().map((n, i) => (
              <li key={i} className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
                <p className="text-fg">{n.text}</p>
                <p className="mt-0.5 text-xs text-fg-3">{n.by} · {relative(n.at)}</p>
              </li>
            ))}
            {!f.notes?.length && <p className="text-sm text-fg-3">No notes yet.</p>}
          </ol>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <Button variant="outline" size="sm" onClick={close}>Close follow-up</Button>
          <Button variant="ghost" size="sm" icon={<Trash2 />} onClick={del} className="text-danger">Delete</Button>
          {f.dueDate && <span className="ml-auto self-center text-xs text-fg-3">Due {fmtDate(f.dueDate)}</span>}
        </div>
      </div>
    </Modal>
  );
}

function NewFollowUp({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [person, setPerson] = useState<{ id: string | null; name: string; member?: { phone: string } } | null>(null);
  const [phone, setPhone] = useState('');
  const [kind, setKind] = useState<FollowUpKind>('pastoral');
  const [due, setDue] = useState(isoDate(new Date(Date.now() + 3 * 864e5)));
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!person) return;
    setBusy(true);
    try {
      await createDoc('followups', { memberId: person.id, name: person.name, phone: person.member?.phone ?? phone, kind, stage: 'new', assignedTo: null, assignedName: '', dueDate: due, notes: [] });
      toast.success('Follow-up created');
      setPerson(null);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New follow-up" footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save} loading={busy} disabled={!person}>Create</Button></>}>
      <div className="space-y-4 pb-24">
        <Field label="Person"><MemberPicker value={person} onChange={setPerson} allowFreeText /></Field>
        {person && !person.id && <TextField label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={kind} onChange={(e) => setKind(e.target.value as FollowUpKind)}>
              {Object.entries(KIND).map(([v, k]) => <option key={v} value={v}>{k.label}</option>)}
            </Select>
          </Field>
          <TextField label="Due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
