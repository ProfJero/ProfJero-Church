import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { authErrorMessage, signUp } from '@/lib/auth';
import { isValidPhone } from '@/lib/phone';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/input';
import { Banner } from '@/components/ui/feedback';
import { useDocumentTitle } from '@/lib/hooks';

export default function Signup() {
  useDocumentTitle('Create account');
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const phoneError = touched && form.phone && !isValidPhone(form.phone) ? 'Enter a valid phone number, e.g. 024 123 4567' : '';
  const pwError = touched && form.password && form.password.length < 6 ? 'Use at least 6 characters' : '';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!form.fullName.trim() || !isValidPhone(form.phone) || form.password.length < 6) return;
    setError('');
    setBusy(true);
    try {
      await signUp(form);
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="animate-slide-up">
      <h1 className="text-2xl font-semibold tracking-tight">Join the family</h1>
      <p className="mt-1.5 text-sm text-fg-3">Create your account to receive devotionals, follow events and send prayer requests.</p>
      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        {error && <Banner tone="danger">{error}</Banner>}
        <TextField label="Full name" autoComplete="name" value={form.fullName} onChange={set('fullName')} required autoFocus error={touched && !form.fullName.trim() ? 'Please enter your name' : ''} />
        <TextField
          label="Phone number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="024 123 4567"
          value={form.phone}
          onChange={set('phone')}
          required
          error={phoneError}
          hint="You can sign in with this number."
        />
        <TextField label="Email (optional)" type="email" autoComplete="email" value={form.email} onChange={set('email')} hint="Add an email so you can reset your password yourself." />
        <TextField label="Password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} required error={pwError} />
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Create account
        </Button>
        <p className="text-center text-xs text-fg-3">By continuing you agree that the church may contact you about church life. You can opt out anytime.</p>
      </form>
      <p className="mt-8 text-center text-sm text-fg-3">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-accent hover:underline dark:text-brand-300">
          Sign in
        </Link>
      </p>
    </div>
  );
}
