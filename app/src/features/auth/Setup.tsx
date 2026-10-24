import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { ShieldCheck } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { authErrorMessage } from '@/lib/auth';
import { normalizePhone, isValidPhone } from '@/lib/phone';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/input';
import { Banner, FullPageLoader } from '@/components/ui/feedback';
import { useDocumentTitle } from '@/lib/hooks';

/** First-run: the first account becomes Super Admin. Locked forever once used. */
export default function Setup() {
  useDocumentTitle('Set up');
  const navigate = useNavigate();
  const [state, setState] = useState<'checking' | 'open' | 'done'>('checking');
  const [form, setForm] = useState({ church: DEFAULT_SETTINGS.name, fullName: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    getDoc(doc(db, 'settings', 'bootstrap'))
      .then((s) => setState(s.exists() ? 'done' : 'open'))
      .catch(() => setState('open'));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim() || !form.email.includes('@') || form.password.length < 8) {
      return setError('Fill in your name, a valid email and a password of at least 8 characters.');
    }
    if (form.phone && !isValidPhone(form.phone)) return setError('Enter a valid phone number or leave it blank.');
    setBusy(true);
    setError('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      await updateProfile(cred.user, { displayName: form.fullName.trim() }).catch(() => {});
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: form.email.trim().toLowerCase(),
        fullName: form.fullName.trim(),
        phone: normalizePhone(form.phone),
        role: 'super_admin',
        isActive: true,
        memberId: null,
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'settings', 'bootstrap'), { by: cred.user.uid, at: serverTimestamp() });
      await batch.commit();
      // Church profile can only be written once the profile above exists.
      const b2 = writeBatch(db);
      b2.set(doc(db, 'settings', 'church'), { ...DEFAULT_SETTINGS, name: form.church.trim() || DEFAULT_SETTINGS.name, updatedAt: serverTimestamp() }, { merge: true });
      await b2.commit().catch(() => {});
      navigate('/admin/settings?welcome=1', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  if (state === 'checking') return <FullPageLoader />;
  if (state === 'done') {
    return (
      <div className="animate-slide-up">
        <h1 className="text-2xl font-semibold tracking-tight">Already set up</h1>
        <p className="mt-2 text-sm text-fg-3">This church app has an administrator. Ask them to give you access.</p>
        <Link to="/login" className="mt-6 inline-block text-sm font-medium text-accent hover:underline dark:text-brand-300">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      <span className="mb-4 grid size-11 place-items-center rounded-xl bg-accent-soft text-accent-soft-fg">
        <ShieldCheck className="size-5" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">Set up your church</h1>
      <p className="mt-1.5 text-sm text-fg-3">Create the first administrator account. This page locks itself once it’s used.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        {error && <Banner tone="danger">{error}</Banner>}
        <TextField label="Church name" value={form.church} onChange={set('church')} required />
        <TextField label="Your full name" autoComplete="name" value={form.fullName} onChange={set('fullName')} required />
        <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
        <TextField label="Phone (optional)" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
        <TextField label="Password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} required hint="At least 8 characters." />
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Create admin account
        </Button>
      </form>
    </div>
  );
}
