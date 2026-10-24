import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Plus, X, Save, CheckCircle2, XCircle, Loader2, Smartphone, Landmark, PartyPopper } from 'lucide-react';
import { toast } from 'sonner';
import { upsertDoc } from '@/lib/db';
import { DEFAULT_SETTINGS, useChurch } from '@/lib/settings';
import { api, apiConfigured } from '@/lib/api';
import { cloudinaryConfigured } from '@/lib/cloudinary';
import { config, firebaseConfig, SIGNATURE } from '@/config';
import { segmentInfo } from '@/lib/sms';
import type { ChurchSettings, PaymentAccount } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Switch, Textarea, TextField } from '@/components/ui/input';
import { Banner } from '@/components/ui/feedback';
import { Badge } from '@/components/ui/badge';
import { ProfJeroMark, CwcLogo } from '@/components/brand';

export default function Settings() {
  const church = useChurch();
  const [params] = useSearchParams();
  const [s, setS] = useState<ChurchSettings>(DEFAULT_SETTINGS);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!church.loading && !loaded) {
      const { loading: _l, ...rest } = church;
      setS(rest);
      setLoaded(true);
    }
  }, [church, loaded]);

  const set = <K extends keyof ChurchSettings>(k: K, v: ChurchSettings[K]) => {
    setS((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };
  const bind = (k: keyof ChurchSettings) => ({ value: (s[k] as string) ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never) });

  async function save() {
    setBusy(true);
    try {
      await upsertDoc('settings', 'church', { ...s, smsSenderId: (s.smsSenderId ?? '').slice(0, 11) }, { audit: 'Updated church settings' });
      toast.success('Settings saved');
      setDirty(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page width="narrow">
      <PageHeader title="Settings" description="Church profile, giving, services and messaging." actions={<Button size="sm" icon={<Save />} onClick={save} loading={busy} disabled={!dirty}>Save changes</Button>} />
      {params.get('welcome') === '1' && (
        <Banner tone="success" icon={<PartyPopper />} className="mb-5" title="Welcome! Your church app is ready.">
          Fill in your church details and giving accounts below. Then add staff in Users &amp; roles, and import your members in People.
        </Banner>
      )}

      <div className="space-y-5">
        <Card>
          <CardHeader title="Church profile" description="Shown on the welcome page, receipts and statements." />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <TextField label="Church name" {...bind('name')} />
            <TextField label="Short name" {...bind('shortName')} maxLength={12} hint="Used in the app header and receipt numbers" />
            <TextField label="Tagline" {...bind('tagline')} className="sm:col-span-2" />
            <TextField label="Address" {...bind('address')} />
            <TextField label="GhanaPost GPS" {...bind('gpsAddress')} />
            <TextField label="Phone" type="tel" {...bind('phone')} />
            <TextField label="Email" type="email" {...bind('email')} />
            <TextField label="Website" {...bind('website')} />
            <TextField label="Service times" {...bind('serviceTimes')} placeholder="Sundays 8:00 AM & 10:30 AM" />
          </div>
        </Card>

        <Card>
          <CardHeader title="Giving accounts" description="Mobile Money and bank details members see on the Give page." />
          <div className="space-y-3 px-5 pb-5">
            <PaymentAccounts value={s.paymentAccounts ?? []} onChange={(v) => set('paymentAccounts', v)} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Categories" description="Shown in this order across the app." />
          <div className="space-y-5 px-5 pb-5">
            <ListEditor label="Giving categories" value={s.givingCategories} onChange={(v) => set('givingCategories', v)} />
            <ListEditor label="Service types" value={s.serviceTypes} onChange={(v) => set('serviceTypes', v)} />
            <ListEditor label="Expense categories" value={s.expenseCategories} onChange={(v) => set('expenseCategories', v)} />
            <ListEditor label="Event categories" value={s.eventCategories} onChange={(v) => set('eventCategories', v)} />
          </div>
        </Card>

        <Card>
          <CardHeader title="SMS" description="Defaults for messages sent through ProfJero Connect." />
          <div className="space-y-4 px-5 pb-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Default Sender ID" {...bind('smsSenderId')} maxLength={11} hint="Must be approved in your ProfJero Connect account (max 11 characters)." />
              <TextField label="Signature" {...bind('smsSignature')} hint="Appended to messages, e.g. “- CWC”" />
            </div>
            <Field label="First-timer welcome SMS" hint={`${segmentInfo(s.welcomeSms ?? '').pages} page(s). Use {first_name|Beloved}.`}><Textarea rows={3} {...bind('welcomeSms')} /></Field>
            <Switch checked={!!s.autoWelcomeSms} onCheckedChange={(v) => set('autoWelcomeSms', v)} label="Offer to send the welcome SMS when a first-timer is added" />
            <Field label="Birthday SMS" hint={`${segmentInfo(s.birthdaySms ?? '').pages} page(s).`}><Textarea rows={3} {...bind('birthdaySms')} /></Field>
            <Switch checked={!!s.autoBirthdaySms} onCheckedChange={(v) => set('autoBirthdaySms', v)} label="Send birthday SMS automatically every morning" description="Runs at 7:00 AM from the CWC Worker (requires its Firebase service account — see README)." />
          </div>
        </Card>

        <Integrations />

        <Card className="flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:text-left">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-800 text-white"><CwcLogo className="w-9" weight={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{church.name} · v{__APP_VERSION__}</p>
            <p className="mt-0.5 flex items-center justify-center gap-1.5 text-sm text-fg-3 sm:justify-start">
              Designed &amp; developed by <ProfJeroMark className="size-3.5 text-brand-600 dark:text-brand-400" /> <span className="font-semibold text-fg-2">{SIGNATURE.name}</span>
            </p>
            <p className="text-xs text-fg-3">{SIGNATURE.tagline}</p>
          </div>
        </Card>
      </div>

      {dirty && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 lg:bottom-6 lg:pl-64">
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-2.5 shadow-[var(--shadow-pop)]">
            <span className="text-sm text-fg-2">You have unsaved changes</span>
            <Button size="sm" onClick={save} loading={busy}>Save</Button>
          </div>
        </div>
      )}
    </Page>
  );
}

function ListEditor({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft('');
  };
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5">
        {value.map((v) => (
          <span key={v} className="inline-flex h-8 items-center gap-1 rounded-lg bg-surface-2 pl-2.5 pr-1 text-[13px]">
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} className="grid size-6 place-items-center rounded-md text-fg-3 hover:bg-surface-3 hover:text-danger"><X className="size-3.5" /></button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} placeholder={`Add to ${label.toLowerCase()}`} />
        <Button variant="outline" icon={<Plus />} onClick={add} disabled={!draft.trim()}>Add</Button>
      </div>
    </Field>
  );
}

function PaymentAccounts({ value, onChange }: { value: PaymentAccount[]; onChange: (v: PaymentAccount[]) => void }) {
  const update = (i: number, patch: Partial<PaymentAccount>) => onChange(value.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  return (
    <>
      {value.length === 0 && <p className="text-sm text-fg-3">No accounts yet. Add your church’s MoMo wallet or merchant number and bank account.</p>}
      {value.map((a, i) => (
        <div key={i} className="rounded-xl border border-line p-3">
          <div className="mb-3 flex items-center gap-2">
            {a.kind === 'momo' ? <Smartphone className="size-4 text-gold-600" /> : <Landmark className="size-4 text-brand-600" />}
            <span className="flex-1 text-sm font-medium">{a.label || 'New account'}</span>
            <Button size="icon-sm" variant="ghost" aria-label="Remove account" icon={<X />} onClick={() => onChange(value.filter((_, j) => j !== i))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Type">
              <Select value={a.kind} onChange={(e) => update(i, { kind: e.target.value as PaymentAccount['kind'] })}>
                <option value="momo">Mobile Money</option>
                <option value="bank">Bank account</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <TextField label="Label" placeholder="e.g. MTN MoMo, GCB Bank" value={a.label} onChange={(e) => update(i, { label: e.target.value })} />
            <TextField label="Account name" value={a.name} onChange={(e) => update(i, { name: e.target.value })} />
            <TextField label={a.kind === 'momo' ? 'MoMo number / merchant ID' : 'Account number'} value={a.number} onChange={(e) => update(i, { number: e.target.value })} />
            <TextField label="Extra details (optional)" placeholder="Branch, USSD code, reference to use…" value={a.extra ?? ''} onChange={(e) => update(i, { extra: e.target.value })} className="sm:col-span-2" />
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" icon={<Smartphone />} onClick={() => onChange([...value, { kind: 'momo', label: 'MTN Mobile Money', name: '', number: '' }])}>Add MoMo</Button>
        <Button size="sm" variant="outline" icon={<Landmark />} onClick={() => onChange([...value, { kind: 'bank', label: '', name: '', number: '' }])}>Add bank</Button>
      </div>
    </>
  );
}

function Integrations() {
  const [health, setHealth] = useState<null | { ok: boolean; sms?: boolean; push?: boolean; media?: boolean; serviceAccount?: boolean; error?: string }>(null);
  useEffect(() => {
    if (!apiConfigured()) return setHealth({ ok: false, error: 'VITE_API_URL is not set' });
    api<{ ok: boolean; sms: boolean; push: boolean; media: boolean; serviceAccount: boolean }>('/v1/health')
      .then(setHealth)
      .catch((e) => setHealth({ ok: false, error: (e as Error).message }));
  }, []);
  const Row = ({ label, ok, detail }: { label: string; ok: boolean | undefined; detail: string }) => (
    <li className="flex items-center gap-3 px-5 py-3">
      {ok === undefined ? <Loader2 className="size-4 animate-spin text-fg-3" /> : ok ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-fg-3" />}
      <span className="flex-1 text-sm">{label}</span>
      <span className="text-right text-xs text-fg-3">{detail}</span>
    </li>
  );
  return (
    <Card>
      <CardHeader title="Integrations" description="Connection status of the services behind the app." />
      <ul className="divide-y divide-line border-t border-line">
        <Row label="Firebase (database & sign-in)" ok detail={config.useEmulators ? 'Local emulators' : firebaseConfig.projectId ?? ''} />
        <Row label="CWC API (Cloudflare Worker)" ok={health ? health.ok : undefined} detail={health?.ok ? 'Online' : health?.error ?? 'Checking…'} />
        <Row label="ProfJero Connect SMS" ok={health ? !!health.sms : undefined} detail={health?.sms ? 'API key set' : 'Add PROFJERO_API_KEY to the Worker'} />
        <Row label="Push notifications" ok={health ? !!health.push : undefined} detail={health?.push ? 'VAPID keys set' : 'Add VAPID keys to the Worker'} />
        <Row label="Cloudinary uploads" ok={cloudinaryConfigured() && (!!config.cloudinaryUploadPreset || !!health?.media)} detail={config.cloudinaryCloudName || 'Set VITE_CLOUDINARY_CLOUD_NAME'} />
        <Row label="Daily automations" ok={health ? !!health.serviceAccount : undefined} detail={health?.serviceAccount ? 'Birthday SMS & reminders enabled' : 'Optional: add a Firebase service account'} />
      </ul>
      <div className="px-5 py-3"><Badge tone="neutral">Secrets never live in the app — only in the Worker.</Badge></div>
    </Card>
  );
}
