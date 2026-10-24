import { useState } from 'react';
import { useParams } from 'react-router';
import { CalendarDays, MapPin, Clock, CalendarPlus, Share2, Check, Users, Minus, Plus, ExternalLink } from 'lucide-react';
import { doc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useEvent, useMyRsvp } from '@/lib/queries';
import { db } from '@/lib/db';
import { fmtDate, fmtTime, num } from '@/lib/format';
import { cld } from '@/lib/cloudinary';
import { downloadBlob, icsFor, shareOrCopy } from '@/lib/files';
import { Button, buttonClass } from '@/components/ui/button';
import { EmptyState, FullPageLoader } from '@/components/ui/feedback';
import { CwcLogo } from '@/components/brand';
import { MemberPage } from './ui';

export default function EventDetail() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const { data: e, loading } = useEvent(id);
  const { data: rsvp } = useMyRsvp(id, user?.uid);
  const [guests, setGuests] = useState(0);
  const [busy, setBusy] = useState(false);
  if (loading) return <FullPageLoader />;
  if (!e) return <EmptyState icon={<CalendarDays />} title="Event not found" />;

  const past = (e.endAt || e.startAt) < new Date().toISOString().slice(0, 16);
  const full = !!e.capacity && (e.rsvpCount ?? 0) >= e.capacity && !rsvp;

  async function toggle() {
    if (!user) return;
    setBusy(true);
    try {
      const b = writeBatch(db);
      const ref = doc(db, 'events', e!.id, 'rsvps', user.uid);
      if (rsvp) {
        b.delete(ref);
        b.update(doc(db, 'events', e!.id), { rsvpCount: increment(-1) });
      } else {
        b.set(ref, { uid: user.uid, name: profile?.fullName ?? 'Member', phone: profile?.phone ?? '', guests, createdAt: serverTimestamp() });
        b.update(doc(db, 'events', e!.id), { rsvpCount: increment(1) });
      }
      await b.commit();
      toast.success(rsvp ? 'RSVP cancelled' : 'You’re going! We’ve saved your spot.');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <MemberPage back={{ to: '/events', label: 'Events' }}>
      <div className="mx-auto max-w-3xl">
        <div className="relative -mx-4 aspect-[16/9] overflow-hidden bg-[linear-gradient(135deg,var(--color-brand-800),var(--color-brand-600))] sm:mx-0 sm:rounded-3xl">
          {e.imageUrl ? <img src={cld(e.imageUrl, { w: 1200 })} alt="" className="size-full object-cover" /> : <CwcLogo className="absolute -bottom-10 -right-10 w-72 text-white/10" />}
        </div>
        <p className="mt-5 text-sm font-medium text-accent dark:text-brand-300">{e.category}</p>
        <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-tight text-balance">{e.title}</h1>

        <div className="card mt-5 divide-y divide-line">
          <div className="flex items-center gap-3 p-4"><Clock className="size-5 text-fg-3" /><div><p className="font-medium">{fmtDate(e.startAt, 'EEEE, d MMMM yyyy')}</p><p className="text-sm text-fg-3">{fmtTime(e.startAt)}{e.endAt ? ` – ${fmtTime(e.endAt)}` : ''}</p></div></div>
          {e.location && <div className="flex items-center gap-3 p-4"><MapPin className="size-5 text-fg-3" /><p className="flex-1 font-medium">{e.location}</p>{e.mapUrl && <a href={e.mapUrl} target="_blank" rel="noreferrer" className={buttonClass('ghost', 'sm')}><ExternalLink /> Map</a>}</div>}
          {e.rsvpEnabled && <div className="flex items-center gap-3 p-4"><Users className="size-5 text-fg-3" /><p className="text-sm text-fg-2">{num(e.rsvpCount)} going{e.capacity ? ` · ${Math.max(0, e.capacity - (e.rsvpCount ?? 0))} spots left` : ''}</p></div>}
        </div>

        {e.description && <p className="mt-6 whitespace-pre-wrap text-[15px] leading-relaxed text-fg-2">{e.description}</p>}

        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 mt-8 md:static">
          <div className="card flex flex-col gap-3 p-3 shadow-[var(--shadow-pop)] sm:flex-row sm:items-center md:shadow-none">
            {e.rsvpEnabled && !past && !rsvp && !full && (
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <span className="text-sm text-fg-2">Bringing guests?</span>
                <span className="flex items-center gap-1">
                  <Button size="icon-sm" variant="outline" aria-label="Fewer guests" icon={<Minus />} onClick={() => setGuests((g) => Math.max(0, g - 1))} />
                  <span className="w-6 text-center font-semibold tabular">{guests}</span>
                  <Button size="icon-sm" variant="outline" aria-label="More guests" icon={<Plus />} onClick={() => setGuests((g) => Math.min(10, g + 1))} />
                </span>
              </div>
            )}
            <div className="flex flex-1 gap-2 sm:justify-end">
              <Button variant="outline" size="lg" className="flex-1 sm:flex-none" icon={<CalendarPlus />} onClick={() => downloadBlob(`${e.title}.ics`, new Blob([icsFor({ ...e, description: e.description })], { type: 'text/calendar' }))} aria-label="Add to calendar" />
              <Button variant="outline" size="lg" className="flex-1 sm:flex-none" icon={<Share2 />} aria-label="Share" onClick={async () => (await shareOrCopy({ title: e.title, text: `${e.title} — ${fmtDate(e.startAt, 'EEE d MMM')} at ${fmtTime(e.startAt)}`, url: location.href })) === 'copied' && toast.success('Link copied')} />
              {e.rsvpEnabled && !past && (
                <Button size="lg" className="flex-[3] sm:flex-none" variant={rsvp ? 'soft' : 'primary'} icon={rsvp ? <Check /> : undefined} loading={busy} disabled={full} onClick={toggle}>
                  {rsvp ? 'Going · Cancel' : full ? 'Fully booked' : 'I’m attending'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </MemberPage>
  );
}
