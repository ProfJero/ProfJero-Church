import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { HeartHandshake, Phone, MessageCircle, Lock, Send, Plus, Check, X, Sparkles, Globe, UserRound } from 'lucide-react';
import { addDoc, arrayUnion, collection, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { useCareLogs, useCareRequests, useTestimonies, useUsers } from '@/lib/queries';
import { db, getActor, patchDoc, useCollection } from '@/lib/db';
import { telHref, whatsappHref, formatPhone } from '@/lib/phone';
import { fmtDate, relative, fmtDateTime } from '@/lib/format';
import { cn, titleCase } from '@/lib/utils';
import type { CareRequest, CareStatus, CareType } from '@/lib/types';
import type { BadgeTone } from '@/lib/permissions';
import { Page, PageHeader } from '@/components/ui/page';
import { Tabs, TabsContent, TabsList, TabsTrigger, Segmented } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState, SkeletonRows } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/dialog';
import { Field, Select, Textarea, TextField } from '@/components/ui/input';
import { CareLogForm, CARE_LOG_TYPES } from './CareLogForm';
import { broadcast } from '../messages/PushPanel';

export const CARE_TYPE: Record<CareType, { label: string; tone: BadgeTone }> = {
  prayer: { label: 'Prayer', tone: 'brand' },
  counselling: { label: 'Counselling', tone: 'info' },
  visit: { label: 'Visitation', tone: 'gold' },
  urgent: { label: 'Urgent', tone: 'danger' },
  thanksgiving: { label: 'Thanksgiving', tone: 'success' },
};
export const CARE_STATUS: Record<CareStatus, { label: string; tone: BadgeTone }> = {
  new: { label: 'New', tone: 'brand' },
  in_progress: { label: 'In progress', tone: 'warning' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
};

export default function AdminCare() {
  const [params, setParams] = useSearchParams();
  const { data, loading } = useCareRequests();
  const [filter, setFilter] = useState<'open' | 'all' | CareType>('open');
  const [openId, setOpenId] = useState<string | null>(params.get('open'));
  useEffect(() => {
    if (params.get('open')) {
      setOpenId(params.get('open'));
      params.delete('open');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const list = data.filter((c) => (filter === 'open' ? !['completed', 'closed'].includes(c.status) : filter === 'all' ? true : c.type === filter));
  const sorted = [...list].sort((a, b) => Number(b.type === 'urgent' && b.status === 'new') - Number(a.type === 'urgent' && a.status === 'new'));
  const open = data.find((c) => c.id === openId) ?? null;

  return (
    <Page>
      <PageHeader title="Pastoral care" description="Prayer, counselling and visitation requests. Visible to pastors and administrators only." />
      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests" count={data.filter((c) => c.status === 'new').length}>Requests</TabsTrigger>
          <TabsTrigger value="log">Care log</TabsTrigger>
          <TabsTrigger value="testimonies">Testimonies</TabsTrigger>
        </TabsList>
        <TabsContent value="requests" className="mt-4">
          <Segmented className="mb-3" value={filter} onChange={setFilter} options={[{ value: 'open', label: 'Open' }, { value: 'prayer', label: 'Prayer' }, { value: 'counselling', label: 'Counselling' }, { value: 'visit', label: 'Visits' }, { value: 'urgent', label: 'Urgent' }, { value: 'all', label: 'All' }]} />
          <Card>
            {loading ? <SkeletonRows /> : sorted.length === 0 ? <EmptyState icon={<HeartHandshake />} title="No requests here" description="New requests from the member app land in this inbox." /> : (
              <ul className="divide-y divide-line">
                {sorted.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => setOpenId(c.id)} className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-surface-2 sm:px-5">
                      <span className={cn('mt-2 size-2 shrink-0 rounded-full', c.status === 'new' ? (c.type === 'urgent' ? 'bg-danger' : 'bg-brand-500') : 'bg-transparent')} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className={cn('truncate text-sm', c.status === 'new' ? 'font-semibold' : 'font-medium')}>{c.subject || c.details.slice(0, 60)}</span>
                          {c.visibility === 'public' && <Globe className="size-3.5 text-fg-3" aria-label="On prayer wall" />}
                        </span>
                        <span className="mt-0.5 line-clamp-1 block text-[13px] text-fg-3">{c.anonymous ? 'Anonymous' : c.name} — {c.details}</span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge tone={CARE_TYPE[c.type]?.tone}>{CARE_TYPE[c.type]?.label}</Badge>
                          <Badge tone={CARE_STATUS[c.status]?.tone}>{CARE_STATUS[c.status]?.label}</Badge>
                          {c.assignedName && <span className="text-xs text-fg-3">→ {c.assignedName}</span>}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-fg-3">{relative(c.createdAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="log" className="mt-4"><CareLogTab /></TabsContent>
        <TabsContent value="testimonies" className="mt-4"><TestimoniesTab /></TabsContent>
      </Tabs>
      <RequestSheet c={open} onClose={() => setOpenId(null)} />
    </Page>
  );
}

function RequestSheet({ c, onClose }: { c: CareRequest | null; onClose: () => void }) {
  const { data: users } = useUsers();
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: notes } = useCollection<{ id: string; text: string; by: string; at: { toMillis?: () => number } }>(c ? `care-notes:${c.id}` : null, () => query(collection(db, 'care_requests', c!.id, 'notes'), orderBy('at', 'desc')));
  const requester = users.find((u) => u.uid === c?.uid);
  const pastors = users.filter((u) => ['super_admin', 'admin', 'pastor'].includes(u.role) && u.isActive !== false);
  const phone = c?.phone || requester?.phone;

  useEffect(() => {
    if (c && c.status === 'new') void patchDoc('care_requests', c.id, { status: 'in_progress' }).catch(() => {});
  }, [c?.id]); // only on open, not on every snapshot

  if (!c) return null;

  async function sendReply() {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await patchDoc('care_requests', c!.id, { responses: arrayUnion({ text: reply.trim(), by: getActor()?.name ?? 'Pastor', at: Date.now() }) });
      if (c!.uid) void broadcast({ title: 'A pastor replied to your request', body: reply.trim().slice(0, 140), url: `/care/${c!.id}`, kind: 'care', audience: c!.uid });
      setReply('');
      toast.success(c!.uid ? 'Reply sent — they’ll get a notification' : 'Reply saved');
    } finally {
      setBusy(false);
    }
  }
  async function addNote() {
    if (!note.trim()) return;
    await addDoc(collection(db, 'care_requests', c!.id, 'notes'), { text: note.trim(), by: getActor()?.name ?? '', at: serverTimestamp() });
    setNote('');
  }
  async function setStatus(status: CareStatus) {
    await patchDoc('care_requests', c!.id, { status });
    if (c!.uid && (status === 'completed' || status === 'scheduled')) {
      void broadcast({ title: status === 'completed' ? 'Your request has been completed' : 'Your request has been scheduled', body: c!.subject || c!.details.slice(0, 100), url: `/care/${c!.id}`, kind: 'care', audience: c!.uid });
    }
  }

  return (
    <Modal open={!!c} onOpenChange={(o) => !o && onClose()} title={c.subject || CARE_TYPE[c.type]?.label} description={`${c.anonymous ? 'Anonymous' : c.name} · ${fmtDateTime(c.createdAt)}`} side>
      <div className="space-y-6">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={CARE_TYPE[c.type]?.tone}>{CARE_TYPE[c.type]?.label}</Badge>
          <Badge tone={c.visibility === 'public' ? 'info' : 'neutral'}>{c.visibility === 'public' ? <><Globe className="size-3" />Prayer wall</> : <><Lock className="size-3" />Private</>}</Badge>
          {c.prayedCount ? <Badge tone="gold">{c.prayedCount} praying</Badge> : null}
        </div>
        <p className="whitespace-pre-wrap rounded-xl bg-surface-2 p-4 text-[15px] leading-relaxed">{c.details}</p>
        {(c.preferredDate || c.location) && <p className="text-sm text-fg-2">{c.preferredDate && <>Preferred: {fmtDate(c.preferredDate)} </>}{c.location && <>· {c.location}</>}</p>}

        <div className="flex flex-wrap gap-2">
          {phone && <a href={telHref(phone)} className={buttonClass('outline', 'sm')}><Phone /> Call {formatPhone(phone)}</a>}
          {phone && <a href={whatsappHref(phone)} target="_blank" rel="noreferrer" className={buttonClass('outline', 'sm')}><MessageCircle /> WhatsApp</a>}
          {c.memberId && <Link to={`/admin/people/${c.memberId}`} className={buttonClass('ghost', 'sm')}><UserRound /> Profile</Link>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Status">
            <Select value={c.status} onChange={(e) => setStatus(e.target.value as CareStatus)}>
              {Object.entries(CARE_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Assigned pastor">
            <Select value={c.assignedTo ?? ''} onChange={(e) => { const u = pastors.find((p) => p.uid === e.target.value); void patchDoc('care_requests', c.id, { assignedTo: e.target.value || null, assignedName: u?.fullName ?? '' }); }}>
              <option value="">Unassigned</option>
              {pastors.map((p) => <option key={p.id} value={p.uid}>{p.fullName}</option>)}
            </Select>
          </Field>
          {c.status === 'scheduled' && <TextField label="Scheduled for" type="datetime-local" value={c.scheduledFor ?? ''} onChange={(e) => patchDoc('care_requests', c.id, { scheduledFor: e.target.value })} />}
        </div>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Conversation <span className="font-normal text-fg-3">— visible to the requester</span></h3>
          <ol className="space-y-2">
            {(c.responses ?? []).map((r, i) => (
              <li key={i} className={cn('rounded-xl px-3 py-2 text-sm', r.by === c.name ? 'bg-surface-2' : 'bg-accent-soft')}>
                <p className="whitespace-pre-wrap">{r.text}</p>
                <p className="mt-0.5 text-xs text-fg-3">{r.by} · {relative(r.at)}</p>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex gap-2">
            <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={c.uid ? 'Write an encouraging reply…' : 'Record what was communicated…'} className="min-h-0" />
            <Button onClick={sendReply} loading={busy} disabled={!reply.trim()} className="self-end" icon={<Send />} aria-label="Send reply" />
          </div>
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Lock className="size-3.5" /> Internal notes <span className="font-normal text-fg-3">— pastors only</span></h3>
          <div className="flex gap-2">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-0" placeholder="Private note" />
            <Button variant="outline" onClick={addNote} disabled={!note.trim()} className="self-end">Add</Button>
          </div>
          <ol className="mt-3 space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-xl border border-dashed border-line-strong px-3 py-2 text-sm">
                <p className="whitespace-pre-wrap">{n.text}</p>
                <p className="mt-0.5 text-xs text-fg-3">{n.by} · {relative(n.at as never)}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Modal>
  );
}

function CareLogTab() {
  const { data, loading } = useCareLogs();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('');
  const list = useMemo(() => data.filter((l) => !type || l.type === type), [data, type]);
  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Select value={type} onChange={(e) => setType(e.target.value)} className="sm:w-56" aria-label="Type">
          <option value="">All care types</option>
          {CARE_LOG_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
        <Button size="sm" icon={<Plus />} onClick={() => setOpen(true)}>Log care</Button>
      </div>
      <Card>
        {loading ? <SkeletonRows /> : list.length === 0 ? <EmptyState icon={<HeartHandshake />} title="No care logged yet" description="Record hospital visits, home visits, calls and counselling sessions." /> : (
          <ul className="divide-y divide-line">
            {list.map((l) => (
              <li key={l.id} className="flex gap-3 px-5 py-3.5">
                <Avatar name={l.memberName} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {l.memberId ? <Link to={`/admin/people/${l.memberId}`} className="font-medium hover:underline">{l.memberName}</Link> : <span className="font-medium">{l.memberName}</span>}
                    <Badge>{CARE_LOG_TYPES.find((t) => t.value === l.type)?.label ?? titleCase(l.type)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-fg-2">{l.summary}</p>
                  <p className="mt-1 text-xs text-fg-3">{fmtDate(l.date)} · {l.byName}{l.nextStep ? ` · Next: ${l.nextStep}` : ''}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <CareLogForm open={open} onOpenChange={setOpen} />
    </>
  );
}

function TestimoniesTab() {
  const { data, loading } = useTestimonies();
  const [filter, setFilter] = useState<'pending' | 'published' | 'rejected'>('pending');
  const list = data.filter((t) => t.status === filter);
  return (
    <>
      <Segmented className="mb-3" value={filter} onChange={setFilter} options={[{ value: 'pending', label: `Pending (${data.filter((t) => t.status === 'pending').length})` }, { value: 'published', label: 'Published' }, { value: 'rejected', label: 'Declined' }]} />
      {loading ? <Card><SkeletonRows /></Card> : list.length === 0 ? <Card><EmptyState icon={<Sparkles />} title="Nothing here" description="Testimonies shared from the member app appear here for review." /></Card> : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((t) => (
            <Card key={t.id} className="flex flex-col p-5">
              <h3 className="font-semibold">{t.title}</h3>
              <p className="mt-0.5 text-xs text-fg-3">{t.name} · {relative(t.createdAt)}</p>
              <p className="mt-3 flex-1 whitespace-pre-wrap text-sm text-fg-2">{t.body}</p>
              <div className="mt-4 flex gap-2">
                {t.status !== 'published' && <Button size="sm" icon={<Check />} onClick={() => patchDoc('testimonies', t.id, { status: 'published' }).then(() => toast.success('Published to the member app'))}>Publish</Button>}
                {t.status !== 'rejected' && <Button size="sm" variant="outline" icon={<X />} onClick={() => patchDoc('testimonies', t.id, { status: 'rejected' })}>{t.status === 'published' ? 'Unpublish' : 'Decline'}</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
