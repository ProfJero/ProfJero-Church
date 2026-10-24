import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Pencil, Trash2, Download, Users, MapPin, Clock, Send, BellRing, ExternalLink, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { useEvent, useRsvps } from '@/lib/queries';
import { removeDoc } from '@/lib/db';
import { fmtDate, fmtTime, num, relative } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { downloadCsv } from '@/lib/files';
import { cld } from '@/lib/cloudinary';
import { sum } from '@/lib/utils';
import { Page, PageHeader } from '@/components/ui/page';
import { Button, buttonClass } from '@/components/ui/button';
import { Card, CardHeader, Stat } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState, FullPageLoader } from '@/components/ui/feedback';
import { useConfirm } from '@/components/ui/confirm';
import { EventForm } from './EventForm';
import { broadcast } from '../messages/PushPanel';
import { useAuth } from '@/lib/auth';
import { sendSms } from '../messages/sms-client';
import { useChurch } from '@/lib/settings';

export default function AdminEventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { can } = useAuth();
  const church = useChurch();
  const { data: e, loading } = useEvent(id);
  const { data: rsvps } = useRsvps(id);
  const [edit, setEdit] = useState(false);

  if (loading) return <FullPageLoader />;
  if (!e) return <Page><EmptyState icon={<CalendarDays />} title="Event not found" /></Page>;
  const guests = sum(rsvps, (r) => r.guests || 0);

  async function del() {
    if (!(await confirm({ title: `Delete “${e!.title}”?`, description: 'RSVPs will be lost.', danger: true, confirmLabel: 'Delete' }))) return;
    await removeDoc('events', e!.id, { audit: `Deleted event ${e!.title}` });
    navigate('/admin/events', { replace: true });
  }
  async function remind() {
    const when = `${fmtDate(e!.startAt, 'EEE d MMM')} at ${fmtTime(e!.startAt)}`;
    await broadcast({ title: `⏰ Reminder: ${e!.title}`, body: `${when}${e!.location ? ` · ${e!.location}` : ''}`, url: `/events/${e!.id}`, kind: 'event' });
    toast.success('Reminder sent to the app');
  }
  async function smsAttendees() {
    const list = rsvps.filter((r) => r.phone);
    if (!list.length) return toast.error('No attendee phone numbers yet');
    if (!(await confirm({ title: `Text ${list.length} attendees?`, description: 'A personalised reminder with the date, time and venue.', confirmLabel: 'Send SMS' }))) return;
    try {
      await sendSms({
        senderId: church.smsSenderId || undefined,
        audience: `RSVPs — ${e!.title}`,
        message: `Hi {first_name|Beloved}, a reminder: ${e!.title} is on ${fmtDate(e!.startAt, 'EEE d MMM')} at ${fmtTime(e!.startAt)}${e!.location ? `, ${e!.location}` : ''}. See you there! ${church.smsSignature ?? ''}`.trim(),
        recipients: list.map((r) => ({ phone: r.phone!, fields: { first_name: r.name.split(' ')[0] } })),
      });
      toast.success('SMS reminders sent');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Page>
      <PageHeader
        back={{ to: '/admin/events', label: 'Events' }}
        eyebrow={e.category}
        title={<span className="flex flex-wrap items-center gap-2">{e.title}{e.status === 'draft' && <Badge>Draft</Badge>}</span>}
        docTitle={e.title}
        actions={
          <>
            {e.status === 'published' && can('messaging.push') && <Button size="sm" variant="outline" icon={<BellRing />} onClick={remind}>Remind</Button>}
            <Button size="sm" icon={<Pencil />} onClick={() => setEdit(true)}>Edit</Button>
            <Button size="icon-sm" variant="outline" className="text-danger" aria-label="Delete event" icon={<Trash2 />} onClick={del} />
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {e.imageUrl && <img src={cld(e.imageUrl, { w: 1200 })} alt="" className="aspect-[16/8] w-full rounded-2xl border border-line object-cover" />}
          <Card className="p-5">
            <div className="flex flex-col gap-2 text-sm text-fg-2 sm:flex-row sm:gap-6">
              <span className="flex items-center gap-2"><Clock className="size-4 text-fg-3" />{fmtDate(e.startAt, 'EEEE d MMMM yyyy')} · {fmtTime(e.startAt)}{e.endAt ? ` – ${fmtTime(e.endAt)}` : ''}</span>
              {e.location && <span className="flex items-center gap-2"><MapPin className="size-4 text-fg-3" />{e.location}</span>}
            </div>
            {e.mapUrl && <a href={e.mapUrl} target="_blank" rel="noreferrer" className={buttonClass('ghost', 'sm', 'mt-2 -ml-2')}><ExternalLink /> Open in Maps</a>}
            {e.description && <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed">{e.description}</p>}
          </Card>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="RSVPs" value={num(rsvps.length)} hint={e.capacity ? `of ${e.capacity}` : undefined} icon={<Users />} />
            <Stat label="With guests" value={num(rsvps.length + guests)} tone="gold" />
          </div>
          <Card>
            <CardHeader
              title="Who’s coming"
              action={
                <div className="flex gap-1">
                  {can('messaging.sms') && rsvps.length > 0 && <Button size="icon-sm" variant="ghost" aria-label="SMS attendees" icon={<Send />} onClick={smsAttendees} />}
                  {rsvps.length > 0 && <Button size="icon-sm" variant="ghost" aria-label="Export" icon={<Download />} onClick={() => downloadCsv(`${e.title}-rsvps.csv`, rsvps.map((r) => ({ Name: r.name, Phone: formatPhone(r.phone), Guests: r.guests })))} />}
                </div>
              }
            />
            {!e.rsvpEnabled ? <EmptyState compact title="RSVPs are off for this event" /> : rsvps.length === 0 ? <EmptyState compact title="No RSVPs yet" /> : (
              <ul className="max-h-[480px] divide-y divide-line overflow-y-auto">
                {rsvps.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-2.5">
                    <Avatar name={r.name} size="sm" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{r.name}</span><span className="block text-xs text-fg-3">{formatPhone(r.phone) || '—'} · {relative(r.createdAt)}</span></span>
                    {r.guests > 0 && <Badge>+{r.guests}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <EventForm open={edit} onOpenChange={setEdit} event={e} />
    </Page>
  );
}
