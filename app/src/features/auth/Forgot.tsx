import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { MailCheck, Phone } from 'lucide-react';
import { authErrorMessage, resetPassword } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/input';
import { Banner } from '@/components/ui/feedback';
import { useDocumentTitle } from '@/lib/hooks';
import { useChurch } from '@/lib/settings';
import { formatPhone } from '@/lib/phone';

export default function Forgot() {
  useDocumentTitle('Reset password');
  const church = useChurch();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) return setError('Enter the email address on your account.');
    setBusy(true);
    setError('');
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      // Don't reveal whether an account exists
      if ((err as { code?: string }).code === 'auth/user-not-found') setSent(true);
      else setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="animate-slide-up text-center">
        <div className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-success-soft text-success">
          <MailCheck className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-2 text-sm text-fg-3">If an account exists for {email}, a reset link is on its way. It can take a minute — check spam too.</p>
        <Link to="/login" className="mt-8 inline-block text-sm font-medium text-accent hover:underline dark:text-brand-300">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1.5 text-sm text-fg-3">We’ll email you a secure link to choose a new password.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        {error && <Banner tone="danger">{error}</Banner>}
        <TextField label="Email address" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Send reset link
        </Button>
      </form>
      <Banner tone="brand" icon={<Phone />} className="mt-6">
        Signed up with only a phone number? Contact the church office{church.phone ? ` on ${formatPhone(church.phone)}` : ''} and an administrator will reset it for you.
      </Banner>
      <p className="mt-8 text-center text-sm text-fg-3">
        <Link to="/login" className="font-medium text-accent hover:underline dark:text-brand-300">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
