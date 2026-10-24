import { useState } from 'react';
import { BellRing, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useSentNotifications, usePublishedEvents, usePublishedDevotionals } from '@/lib/queries';
import { createDoc, patchDoc } from '@/lib/db';
import { sendPush } from '@/lib/push';
import { apiConfigured } from '@/lib/api';
import { isoDate, relative } from '@/lib/format';
import type { AppNotification } from '@/lib/types';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea, TextField } from '@/components/ui/input';
import { EmptyState, Banner } from '@/components/ui/feedback';
import { Badge } from '@/components/ui/badge';

/** Broadcast to every member's app: saved to the in-app inbox and pushed to devices. */
export async function broadcast(n: { title: string; body: string; url?: string; kind: AppNotification['kind']; audience?: 'all' | string; image?: string }) {
  const id = await createDoc('notifications', { title: n.title, body: n.body, url: n.url ?? '/notifications', audience: n.audience ?? 'all', kind: n.kind, push: null });
  if (!apiConfigured()) return { id, push: null };
  try {
    const res = await sendPush({ title: n.title, body: n.body, url: n.url, image: n.image, audience: n.audience && n.audience !== 'all' ? { uids: [n.audience] } : 'all', tag: id });
    await patchDoc('notifications', id, { push: { sent: res.sent, failed: res.failed } });
    return { id, push: res };
  } catch (e) {
    console.warn('[cwc] push failed', e);
    return { id, push: null };
  }
}

export function PushPanel() {
  const { data: sent } = useSentNotifications();
  const { data: events } = usePublishedEvents();
  const { data: devs } = usePublishedDevotionals(isoDate());
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('/notifications');
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    try {
      const r = await broadcast({ title: title.trim(), body: body.trim(), url: link, kind: 'announcement' });
      toast.success(r.push ? `Delivered to ${r.push.sent} devices` : 'Posted to the in-app inbox');
      setTitle('');
      setBody('');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader title="Send a notification" description="Free and instant to everyone who installed the app." icon={<BellRing />} />
        <div className="space-y-4 px-5 pb-5">
          {!apiConfigured() && <Banner tone="info">Without the Worker, notifications still appear in members’ in-app inbox.</Banner>}
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="e.g. Service starts in 1 hour" />
          <Field label="Message" hint={`${body.length}/180`}>
            <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value.slice(0, 180))} />
          </Field>
          <Field label="Opens">
            <Select value={link} onChange={(e) => setLink(e.target.value)}>
              <option value="/notifications">Notifications inbox</option>
              <option value="/">Home</option>
              <option value="/give">Give page</option>
              <option value="/care/new">Prayer request form</option>
              {devs.slice(0, 5).map((d) => <option key={d.id} value={`/devotionals/${d.id}`}>Devotional: {d.title}</option>)}
              {events.slice(0, 8).map((e) => <option key={e.id} value={`/events/${e.id}`}>Event: {e.title}</option>)}
            </Select>
          </Field>
          <Button className="w-full" icon={<Send />} onClick={send} loading={busy} disabled={!title.trim() || !body.trim()}>Send to everyone</Button>
        </div>
      </Card>
      <Card className="lg:col-span-3">
        <CardHeader title="Recent notifications" />
        {sent.length === 0 ? (
          <EmptyState compact title="Nothing sent yet" />
        ) : (
          <ul className="divide-y divide-line">
            {sent.slice(0, 30).map((n) => (
              <li key={n.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium">{n.title}</span>
                  <span className="shrink-0 text-xs text-fg-3">{relative(n.createdAt)}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[13px] text-fg-3">{n.body}</p>
                <div className="mt-1.5 flex gap-1.5">
                  <Badge>{n.audience === 'all' ? 'Everyone' : 'One person'}</Badge>
                  {n.push && <Badge tone="success">{n.push.sent} devices</Badge>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
