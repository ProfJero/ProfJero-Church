import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Lock, Globe, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isoDate } from '@/lib/format';
import { useOnline } from '@/lib/pwa';
import { cn } from '@/lib/utils';
import type { CareType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Switch, Textarea, TextField } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { MemberPage } from './ui';

const COPY: Record<string, { title: string; subtitle: string; placeholder: string }> = {
  prayer: { title: 'Prayer request', subtitle: 'Share what’s on your heart. The pastors and prayer team will stand with you.', placeholder: 'How can we pray for you?' },
  counselling: { title: 'Counselling', subtitle: 'Confidential — only pastors can see this.', placeholder: 'Briefly, what would you like to talk about?' },
  visit: { title: 'Request a visit', subtitle: 'Home, hospital or office — tell us where and when.', placeholder: 'Who should we visit, and why?' },
  urgent: { title: 'Urgent need', subtitle: 'A pastor will contact you as soon as possible.', placeholder: 'What has happened? How can we reach you?' },
  thanksgiving: { title: 'Share a testimony', subtitle: 'Your story will encourage someone. The church office reviews testimonies before sharing.', placeholder: 'What has God done for you?' },
};

export default function CareNew() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const online = useOnline();
  const { user, profile } = useAuth();
  const type = (params.get('type') as CareType) || 'prayer';
  const copy = COPY[type] ?? COPY.prayer;
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [anonymous, setAnonymous] = useState(false);
  const [preferredDate, setPreferredDate] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState(profile?.phone ? '0' + profile.phone.slice(3) : '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!details.trim() || !user) return;
    setBusy(true);
    try {
      const name = profile?.fullName ?? 'Member';
      if (type === 'thanksgiving') {
        const p = addDoc(collection(db, 'testimonies'), { uid: user.uid, name, title: subject.trim() || 'My testimony', body: details.trim(), status: 'pending', createdAt: serverTimestamp() });
        if (online) await p;
      } else {
        const p = addDoc(collection(db, 'care_requests'), {
          type, uid: user.uid, memberId: profile?.memberId ?? null, name,
          phone: visibility === 'public' ? '' : phone,
          subject: subject.trim(), details: details.trim(),
          visibility: type === 'prayer' ? visibility : 'private',
          anonymous: type === 'prayer' && visibility === 'public' ? anonymous : false,
          preferredDate, location, status: 'new', assignedTo: null, assignedName: '', responses: [], prayedCount: 0,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        // Offline: Firestore queues the write and sends it when the connection returns.
        if (online) await p;
      }
      setDone(true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <MemberPage>
        <Card className="mx-auto max-w-md p-8 text-center">
          <CheckCircle2 className="mx-auto size-12 text-success" />
          <h1 className="mt-4 text-xl font-semibold">{type === 'thanksgiving' ? 'Thank you for sharing!' : 'We’ve received your request'}</h1>
          <p className="mt-2 text-sm text-fg-3">{!online ? 'You’re offline — it will be sent automatically when you reconnect. ' : ''}{type === 'thanksgiving' ? 'Your testimony will appear once reviewed.' : type === 'prayer' ? 'We are praying with you. You’ll get a notification when a pastor replies.' : 'A pastor will reach out to you soon.'}</p>
          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={() => navigate('/care')}>Done</Button>
            {type === 'prayer' && <Button variant="ghost" onClick={() => navigate('/care/wall')}>Visit the prayer wall</Button>}
          </div>
        </Card>
      </MemberPage>
    );
  }

  return (
    <MemberPage title={copy.title} subtitle={copy.subtitle} back={{ to: '/care', label: 'Care' }}>
      <form onSubmit={submit} className="mx-auto max-w-xl space-y-4">
        <Field label="Type">
          <Select value={type} onChange={(e) => navigate(`/care/new?type=${e.target.value}`, { replace: true })}>
            <option value="prayer">Prayer request</option>
            <option value="counselling">Counselling</option>
            <option value="visit">Visitation</option>
            <option value="urgent">Urgent need</option>
            <option value="thanksgiving">Testimony / thanksgiving</option>
          </Select>
        </Field>
        <TextField label={type === 'thanksgiving' ? 'Title' : 'Subject (optional)'} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={80} placeholder={type === 'prayer' ? 'e.g. Healing for my mother' : ''} />
        <Field label="Details">
          <Textarea rows={6} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={copy.placeholder} required />
        </Field>
        {type === 'prayer' && (
          <div className="grid grid-cols-2 gap-2">
            {(['private', 'public'] as const).map((v) => (
              <button key={v} type="button" onClick={() => setVisibility(v)} className={cn('rounded-xl border p-3 text-left', visibility === v ? 'border-brand-500 bg-accent-soft ring-1 ring-brand-500' : 'border-line')}>
                {v === 'private' ? <Lock className="size-4" /> : <Globe className="size-4" />}
                <span className="mt-1.5 block text-sm font-semibold">{v === 'private' ? 'Pastors only' : 'Prayer wall'}</span>
                <span className="block text-xs text-fg-3">{v === 'private' ? 'Kept confidential' : 'The church family can pray too'}</span>
              </button>
            ))}
          </div>
        )}
        {type === 'prayer' && visibility === 'public' && <Switch checked={anonymous} onCheckedChange={setAnonymous} label="Post anonymously" description="Your name won’t show on the wall." />}
        {(type === 'visit' || type === 'counselling') && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Preferred date"><Input type="date" min={isoDate()} value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} /></Field>
            {type === 'visit' && <TextField label="Where?" placeholder="Home address, hospital & ward…" value={location} onChange={(e) => setLocation(e.target.value)} />}
          </div>
        )}
        {visibility !== 'public' && type !== 'thanksgiving' && <TextField label="Best phone number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!details.trim()}>{type === 'thanksgiving' ? 'Share testimony' : 'Send request'}</Button>
      </form>
    </MemberPage>
  );
}
