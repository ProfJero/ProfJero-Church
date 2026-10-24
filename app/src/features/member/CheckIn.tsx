import { useState } from 'react';
import { useParams } from 'react-router';
import { CheckCircle2, ScanLine, Lock, UserRound } from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/auth';
import { useService } from '@/lib/queries';
import { db, useDocument } from '@/lib/db';
import { fmtDate } from '@/lib/format';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FullPageLoader } from '@/components/ui/feedback';
import type { AttendanceRecord } from '@/lib/types';
import { MemberPage } from './ui';

export default function CheckIn() {
  const { id } = useParams();
  const { profile } = useAuth();
  const { data: s, loading } = useService(id);
  const memberId = profile?.memberId;
  const { data: existing } = useDocument<AttendanceRecord>(id && memberId ? `attendance/${id}_${memberId}` : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (loading) return <FullPageLoader />;

  async function checkIn() {
    setBusy(true);
    setError('');
    try {
      await setDoc(doc(db, 'attendance', `${id}_${memberId}`), { serviceId: id, serviceType: s!.type, date: s!.date, memberId, memberName: profile?.fullName ?? '', method: 'self', checkedInAt: serverTimestamp() });
    } catch {
      setError('Check-in didn’t go through. Please ask an usher to check you in.');
    } finally {
      setBusy(false);
    }
  }

  const state = !s ? 'missing' : existing ? 'done' : !s.isOpen ? 'closed' : !memberId ? 'unlinked' : 'ready';
  const view = {
    missing: { icon: <ScanLine className="size-12 text-fg-3" />, title: 'Service not found', text: 'This check-in code may have expired.' },
    done: { icon: <CheckCircle2 className="size-14 text-success" />, title: 'You’re checked in!', text: `Welcome to ${s?.title}. We’re glad you’re here.` },
    closed: { icon: <Lock className="size-12 text-fg-3" />, title: 'Check-in has closed', text: 'Ushers can still record your attendance.' },
    unlinked: { icon: <UserRound className="size-12 text-fg-3" />, title: 'Almost there', text: 'Your app account isn’t linked to your church record yet. Please ask an usher to check you in today — they can link your account too.' },
    ready: { icon: <ScanLine className="size-12 text-accent" />, title: s?.title ?? '', text: s ? fmtDate(s.date, 'EEEE d MMMM') : '' },
  }[state];

  return (
    <MemberPage>
      <Card className="mx-auto max-w-sm p-8 text-center">
        <div className="mx-auto grid place-items-center">{view.icon}</div>
        <h1 className="mt-4 text-xl font-semibold">{view.title}</h1>
        <p className="mt-2 text-sm text-fg-3">{view.text}</p>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        {state === 'ready' && <Button size="lg" className="mt-6 w-full" onClick={checkIn} loading={busy}>Check me in</Button>}
        {state !== 'ready' && <ButtonLink to="/" variant="outline" className="mt-6 w-full">Go home</ButtonLink>}
      </Card>
    </MemberPage>
  );
}
