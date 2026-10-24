import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Minus, Plus, QrCode, Lock, Unlock, Pencil, UserPlus, Check, X, Trash2, Download, CalendarCheck2 } from 'lucide-react';
import { deleteDoc, doc, increment, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { useMembers, useService, useServiceAttendance } from '@/lib/queries';
import { db, getActor, patchDoc, removeDoc } from '@/lib/db';
import { formatPhone } from '@/lib/phone';
import { fmtDate, fmtTime, num } from '@/lib/format';
import { downloadCsv } from '@/lib/files';
import { serviceTotal } from '@/lib/stats';
import { cn } from '@/lib/utils';
import type { Member, Service } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Button, buttonClass } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardHeader } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/input';
import { EmptyState, FullPageLoader } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/dialog';
import { useConfirm } from '@/components/ui/confirm';
import { matchMember } from '@/components/member-picker';
import { ServiceForm } from './ServiceForm';
import { PersonForm } from '../people/shared';
import { useAuth } from '@/lib/auth';

const COUNTERS: { key: keyof Service['headcount']; label: string }[] = [
  { key: 'men', label: 'Men' },
  { key: 'women', label: 'Women' },
  { key: 'children', label: 'Children' },
  { key: 'visitors', label: 'Visitors' },
];

export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { can } = useAuth();
  const { data: s, loading } = useService(id);
  const { data: records } = useServiceAttendance(id);
  const { data: members } = useMembers();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(false);
  const [qr, setQr] = useState(false);
  const [newPerson, setNewPerson] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const checkedIn = useMemo(() => new Set(records.map((r) => r.memberId)), [records]);

  // Keep the stored count in step with live check-ins (self check-ins can't update it themselves).
  useEffect(() => {
    if (s && records.length !== (s.checkins ?? 0) && can('attendance.manage')) {
      void updateDoc(doc(db, 'services', s.id), { checkins: records.length }).catch(() => {});
    }
  }, [records.length, s, can]);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    return members.filter((m) => !['deceased', 'transferred'].includes(m.membershipStatus) && matchMember(m, q)).slice(0, 8);
  }, [members, q]);

  if (loading) return <FullPageLoader />;
  if (!s) return <Page><EmptyState icon={<CalendarCheck2 />} title="Service not found" /></Page>;

  const h = s.headcount ?? { men: 0, women: 0, children: 0, visitors: 0 };

  async function bump(key: keyof Service['headcount'], by: number) {
    if ((h[key] ?? 0) + by < 0) return;
    navigator.vibrate?.(8);
    await updateDoc(doc(db, 'services', s!.id), { [`headcount.${key}`]: increment(by) });
  }

  async function checkIn(m: Member) {
    if (checkedIn.has(m.id)) return toast.info(`${m.firstName} is already checked in`);
    navigator.vibrate?.(15);
    await setDoc(doc(db, 'attendance', `${s!.id}_${m.id}`), {
      serviceId: s!.id,
      serviceType: s!.type,
      date: s!.date,
      memberId: m.id,
      memberName: m.fullName,
      method: 'manual',
      checkedInAt: serverTimestamp(),
      by: getActor()?.uid ?? null,
    });
    if (m.membershipStatus === 'first_timer') await updateDoc(doc(db, 'services', s!.id), { firstTimers: increment(1) }).catch(() => {});
    toast.success(`${m.fullName} checked in`);
    setQ('');
  }

  async function undo(memberId: string) {
    await deleteDoc(doc(db, 'attendance', `${s!.id}_${memberId}`));
  }

  async function toggleOpen() {
    await patchDoc('services', s!.id, { isOpen: !s!.isOpen }, { audit: `${s!.isOpen ? 'Closed' : 'Reopened'} ${s!.title} (${s!.date})` });
    toast.success(s!.isOpen ? 'Service closed — check-in stopped' : 'Service reopened');
  }

  async function del() {
    if (!(await confirm({ title: 'Delete this service?', description: 'Headcounts are removed. Individual check-ins remain in member histories.', danger: true, confirmLabel: 'Delete' }))) return;
    await removeDoc('services', s!.id, { audit: `Deleted service ${s!.title} (${s!.date})` });
    navigate('/admin/attendance', { replace: true });
  }

  return (
    <Page>
      <PageHeader
        back={{ to: '/admin/attendance', label: 'Attendance' }}
        eyebrow={fmtDate(s.date, 'EEEE, d MMMM yyyy') + (s.startTime ? ` · ${fmtTime(`2000-01-01T${s.startTime}`)}` : '')}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {s.title} {s.isOpen ? <Badge tone="success" dot>Live</Badge> : <Badge>Closed</Badge>}
          </span>
        }
        docTitle={s.title}
        description={[s.theme, s.preacher].filter(Boolean).join(' — ')}
        actions={
          <>
            {s.isOpen && <Button size="sm" variant="outline" icon={<QrCode />} onClick={() => setQr(true)}>QR check-in</Button>}
            <Button size="sm" variant="outline" icon={s.isOpen ? <Lock /> : <Unlock />} onClick={toggleOpen}>{s.isOpen ? 'Close' : 'Reopen'}</Button>
            <Button size="icon-sm" variant="outline" icon={<Pencil />} aria-label="Edit service" onClick={() => setEdit(true)} />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[15px] font-semibold">Headcount</h3>
              <span className="text-sm text-fg-3">Total <span className="text-xl font-semibold text-fg">{num(serviceTotal(s))}</span></span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {COUNTERS.map((c) => (
                <div key={c.key} className="rounded-xl border border-line p-3">
                  <div className="text-xs font-medium text-fg-3">{c.label}</div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <button type="button" aria-label={`Decrease ${c.label}`} onClick={() => bump(c.key, -1)} className="grid size-10 place-items-center rounded-xl bg-surface-2 text-fg-2 active:scale-95 disabled:opacity-40" disabled={!h[c.key]}>
                      <Minus className="size-4" />
                    </button>
                    <span className="text-2xl font-semibold tabular">{num(h[c.key])}</span>
                    <button type="button" aria-label={`Increase ${c.label}`} onClick={() => bump(c.key, 1)} className="grid size-10 place-items-center rounded-xl bg-accent text-accent-fg active:scale-95">
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex gap-1">
                    {[5, 10].map((n) => (
                      <button key={n} type="button" onClick={() => bump(c.key, n)} className="h-7 flex-1 rounded-lg text-xs font-medium text-fg-3 hover:bg-surface-2">+{n}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-fg-3">Counters sync live — several ushers can count at once.</p>
          </Card>
          <Card className="p-5 text-sm">
            <div className="flex justify-between"><span className="text-fg-3">Checked in by name</span><span className="font-medium tabular">{num(records.length)}</span></div>
            <div className="mt-2 flex justify-between"><span className="text-fg-3">First-timers</span><span className="font-medium tabular">{num(s.firstTimers)}</span></div>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" icon={<Download />} disabled={!records.length} onClick={() => downloadCsv(`${s.title}-${s.date}.csv`, records.map((r) => ({ Name: r.memberName, Method: r.method, Date: r.date })))}>Export</Button>
              <Button size="sm" variant="ghost" className="text-danger" icon={<Trash2 />} onClick={del}>Delete</Button>
            </div>
          </Card>
        </div>

        <div className="order-first space-y-4 lg:order-none lg:col-span-3">
          <Card className="p-4 sm:p-5" >
            <div ref={searchRef} className="flex flex-col gap-2 sm:flex-row">
              <SearchInput value={q} onChange={setQ} placeholder="Find a person to check in…" className="flex-1" autoFocus={window.innerWidth >= 1024} />
              <Button variant="outline" icon={<UserPlus />} onClick={() => setNewPerson(true)}>First-timer</Button>
            </div>
            {!s.isOpen && <p className="mt-2 text-xs text-warning">This service is closed. Reopen it to check people in.</p>}
            {q && (
              <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
                {results.length === 0 && <li className="px-4 py-6 text-center text-sm text-fg-3">No one matches “{q}”. Add them as a first-timer.</li>}
                {results.map((m) => {
                  const done = checkedIn.has(m.id);
                  return (
                    <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                      <Avatar name={m.fullName} src={m.photoUrl} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{m.fullName}</div>
                        <div className="truncate text-xs text-fg-3">{formatPhone(m.phone) || '—'}</div>
                      </div>
                      <Button size="md" variant={done ? 'soft' : 'primary'} icon={done ? <Check /> : undefined} disabled={done || !s.isOpen} onClick={() => checkIn(m)} className="min-w-28">
                        {done ? 'In' : 'Check in'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title={`Checked in · ${records.length}`} description="Most recent first" />
            {records.length === 0 ? (
              <EmptyState compact title="No check-ins yet" description="Search above, or show the QR code so members can check themselves in." />
            ) : (
              <ul className="max-h-[520px] divide-y divide-line overflow-y-auto">
                {[...records]
                  .sort((a, b) => ((b.checkedInAt?.toMillis?.() ?? 0) - (a.checkedInAt?.toMillis?.() ?? 0)))
                  .map((r) => (
                    <li key={r.id} className="flex items-center gap-3 px-5 py-2.5">
                      <Avatar name={r.memberName} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.memberName}</span>
                        <span className="block text-xs text-fg-3">{r.method === 'self' ? 'Self check-in (QR)' : 'Checked in by usher'} · {fmtTime(r.checkedInAt)}</span>
                      </span>
                      <Button size="icon-sm" variant="ghost" aria-label={`Undo check-in for ${r.memberName}`} icon={<X />} onClick={() => undo(r.memberId)} />
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ServiceForm open={edit} onOpenChange={setEdit} service={s} />
      <QrModal open={qr} onOpenChange={setQr} service={s} />
      <PersonForm
        open={newPerson}
        onOpenChange={setNewPerson}
        defaults={{ membershipStatus: 'first_timer', firstName: q.split(' ')[0] ?? '', lastName: q.split(' ').slice(1).join(' ') }}
        onSaved={async (mid) => {
          await setDoc(doc(db, 'attendance', `${s.id}_${mid}`), { serviceId: s.id, serviceType: s.type, date: s.date, memberId: mid, memberName: 'First-timer', method: 'manual', checkedInAt: serverTimestamp() });
          await updateDoc(doc(db, 'services', s.id), { firstTimers: increment(1), 'headcount.visitors': increment(1) });
          const m = members.find((x) => x.id === mid);
          if (m) await updateDoc(doc(db, 'attendance', `${s.id}_${mid}`), { memberName: m.fullName });
          setQ('');
        }}
      />
    </Page>
  );
}

function QrModal({ open, onOpenChange, service }: { open: boolean; onOpenChange: (o: boolean) => void; service: Service }) {
  const [src, setSrc] = useState('');
  const url = `${location.origin}/checkin/${service.id}`;
  useEffect(() => {
    if (open) QRCode.toDataURL(url, { margin: 1, width: 520, color: { dark: '#121c40', light: '#ffffff' } }).then(setSrc);
  }, [open, url]);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Self check-in" description="Members scan this with their phone camera, sign in once, and they’re checked in." size="sm">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rounded-2xl border border-line bg-white p-4">{src && <img src={src} alt="Check-in QR code" className="size-64" />}</div>
        <div>
          <div className="font-semibold">{service.title}</div>
          <div className="text-sm text-fg-3">{fmtDate(service.date, 'EEEE d MMMM')}</div>
        </div>
        <code className={cn('max-w-full truncate rounded-lg bg-surface-2 px-2 py-1 text-xs text-fg-2')}>{url}</code>
        <a href={src} download={`checkin-${service.date}.png`} className={buttonClass('outline', 'sm')}>
          <Download /> Download to print
        </a>
      </div>
    </Modal>
  );
}
