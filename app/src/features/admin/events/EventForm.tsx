import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Switch, Textarea, TextField } from '@/components/ui/input';
import { ImageUpload } from '@/components/image-upload';
import { createDoc, patchDoc } from '@/lib/db';
import { useChurch } from '@/lib/settings';
import { fmtDate, fmtTime } from '@/lib/format';
import type { ChurchEvent, ContentStatus } from '@/lib/types';
import { broadcast } from '../messages/PushPanel';

const empty = () => {
  const d = new Date(Date.now() + 7 * 864e5);
  d.setHours(9, 0, 0, 0);
  const local = (x: Date) => new Date(x.getTime() - x.getTimezoneOffset() * 60e3).toISOString().slice(0, 16);
  return { title: '', category: 'Service', description: '', startAt: local(d), endAt: local(new Date(d.getTime() + 3 * 3600e3)), location: '', mapUrl: '', imageUrl: '', status: 'published' as ContentStatus, rsvpEnabled: true, capacity: '' };
};

export function EventForm({ open, onOpenChange, event, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; event?: ChurchEvent | null; onSaved?: (id: string) => void }) {
  const church = useChurch();
  const [f, setF] = useState(empty);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setF(event ? { title: event.title, category: event.category, description: event.description ?? '', startAt: event.startAt, endAt: event.endAt ?? '', location: event.location ?? '', mapUrl: event.mapUrl ?? '', imageUrl: event.imageUrl ?? '', status: event.status, rsvpEnabled: event.rsvpEnabled, capacity: event.capacity ? String(event.capacity) : '' } : { ...empty(), location: church.address ?? '' });
    setNotify(!event || event.status === 'draft');
  }, [open, event, church.address]);
  const bind = (k: 'title' | 'category' | 'description' | 'startAt' | 'endAt' | 'location' | 'mapUrl' | 'capacity') => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value })) });

  async function save() {
    if (!f.title.trim() || !f.startAt) return toast.error('Title and start time are required');
    if (f.endAt && f.endAt < f.startAt) return toast.error('End time is before the start');
    setBusy(true);
    try {
      const data = { ...f, title: f.title.trim(), capacity: f.capacity ? Number(f.capacity) : null };
      let id = event?.id;
      if (event) await patchDoc('events', event.id, data, { audit: `Updated event ${data.title}` });
      else id = await createDoc('events', { ...data, rsvpCount: 0 }, { audit: `Created event ${data.title}` });
      const justPublished = data.status === 'published' && (!event || event.status === 'draft');
      if (justPublished && notify && id) {
        const when = `${fmtDate(data.startAt, 'EEE d MMM')} · ${fmtTime(data.startAt)}`;
        void broadcast({ title: `📅 ${data.title}`, body: `${when}${data.location ? ` · ${data.location}` : ''}`, url: `/events/${id}`, kind: 'event', image: data.imageUrl || undefined });
      }
      toast.success(event ? 'Event updated' : data.status === 'published' ? 'Event published' : 'Draft saved');
      onSaved?.(id!);
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
      title={event ? 'Edit event' : 'New event'}
      size="lg"
      footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save} loading={busy}>{f.status === 'published' ? (event?.status === 'published' ? 'Save' : 'Publish') : 'Save draft'}</Button></>}
    >
      <div className="space-y-4">
        <ImageUpload value={f.imageUrl} onChange={(v) => setF((s) => ({ ...s, imageUrl: v }))} folder="events" label="Event banner (16:9)" />
        <TextField label="Title" required {...bind('title')} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Category"><Select {...bind('category')}>{church.eventCategories.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Starts"><Input type="datetime-local" {...bind('startAt')} /></Field>
          <Field label="Ends"><Input type="datetime-local" {...bind('endAt')} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Venue" {...bind('location')} />
          <TextField label="Google Maps link (optional)" placeholder="https://maps.app.goo.gl/…" {...bind('mapUrl')} />
        </div>
        <Field label="Description"><Textarea rows={5} {...bind('description')} /></Field>
        <div className="grid gap-4 rounded-xl border border-line p-4 sm:grid-cols-2">
          <Switch checked={f.rsvpEnabled} onCheckedChange={(v) => setF((s) => ({ ...s, rsvpEnabled: v }))} label="Allow RSVPs" description="Members tap “I’m attending” in the app." />
          {f.rsvpEnabled && <TextField label="Capacity (optional)" type="number" inputMode="numeric" {...bind('capacity')} />}
          <Switch checked={f.status === 'published'} onCheckedChange={(v) => setF((s) => ({ ...s, status: v ? 'published' : 'draft' }))} label="Published" description="Drafts are visible to staff only." />
          {f.status === 'published' && (!event || event.status === 'draft') && <Switch checked={notify} onCheckedChange={setNotify} label="Notify members" description="Push notification + inbox." />}
        </div>
      </div>
    </Modal>
  );
}
