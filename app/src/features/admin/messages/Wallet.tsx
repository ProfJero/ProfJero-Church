import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Wallet as WalletIcon, RefreshCw, CreditCard, Smartphone, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError, apiConfigured } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cedis, num, relative, fmtDateTime } from '@/lib/format';
import { cn, uid } from '@/lib/utils';
import { Card, CardHeader, Stat } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Banner, EmptyState, Spinner } from '@/components/ui/feedback';
import { Field, Input, TextField } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface WalletInfo { availableUnits: number; reservedUnits: number; totalUnits: number; lowBalanceThreshold: number | null; updatedAt: string }
interface Pkg { id: string; name?: string; units: number; amountGhs?: number; priceGhs?: number; amount?: number }
interface Pricing { unitPriceGhs?: number; unitPrice?: number; currency?: string; packages?: Pkg[] }
interface Payment { reference: string; packageId?: string | null; units: number; amountGhs: number; status: string; paidAt: string | null; createdAt?: string }
interface Txn { id?: string; type?: string; units?: number; delta?: number; description?: string; createdAt?: string }

const pkgPrice = (p: Pkg) => p.amountGhs ?? p.priceGhs ?? p.amount ?? 0;

export function Wallet() {
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState<string>('');
  const [customUnits, setCustomUnits] = useState('');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [paying, setPaying] = useState<'mobile_money' | 'card' | null>(null);

  const load = useCallback(async () => {
    if (!apiConfigured()) return setLoading(false);
    setLoading(true);
    setError('');
    try {
      const [w, p, pay, t] = await Promise.all([
        api<WalletInfo>('/v1/sms/wallet'),
        api<Pricing>('/v1/sms/pricing').catch(() => null),
        api<{ payments: Payment[] }>('/v1/sms/payments?limit=10').catch(() => ({ payments: [] })),
        api<{ transactions: Txn[] }>('/v1/sms/transactions?limit=20').catch(() => ({ transactions: [] })),
      ]);
      setWallet(w);
      setPricing(p);
      setPayments(pay.payments ?? []);
      setTxns(t.transactions ?? []);
      if (p?.packages?.length) setChoice((c) => c || p.packages![0].id);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Returning from checkout: confirm the payment (credits the wallet if paid)
  useEffect(() => {
    const ref = params.get('ref') || params.get('reference') || sessionStorage.getItem('cwc-last-topup');
    if (!ref || !apiConfigured()) return;
    sessionStorage.removeItem('cwc-last-topup');
    api<{ payment: Payment }>(`/v1/sms/payments/${encodeURIComponent(ref)}`)
      .then(({ payment }) => {
        if (payment.status === 'paid' || payment.status === 'success' || payment.paidAt) toast.success(`Top-up successful — ${num(payment.units)} units added`);
        else toast.info(`Payment is ${payment.status}. It will be credited automatically once confirmed.`);
        void load();
      })
      .catch(() => {})
      .finally(() => {
        if (params.has('ref') || params.has('reference')) {
          params.delete('ref');
          params.delete('reference');
          setParams(params, { replace: true });
        }
      });
  }, [params, setParams, load]);

  const unitPrice = pricing?.unitPriceGhs ?? pricing?.unitPrice;

  async function topUp(method: 'mobile_money' | 'card') {
    const body: Record<string, unknown> = { method, callbackUrl: `${location.origin}/admin/messages?tab=wallet` };
    if (choice === 'custom') {
      const units = Number(customUnits);
      if (!units || units < 1) return toast.error('Enter how many units to buy');
      body.units = Math.round(units);
    } else if (choice) body.packageId = choice;
    else return toast.error('Choose a package');
    if (email) body.email = email;
    setPaying(method);
    try {
      const res = await api<{ payment: Payment; checkoutUrl: string }>('/v1/sms/payments', { method: 'POST', json: body, idempotencyKey: `topup-${uid()}` });
      // ProfJero returns the payer to callbackUrl; we add the reference so we can confirm on return.
      sessionStorage.setItem('cwc-last-topup', res.payment.reference);
      location.href = res.checkoutUrl;
    } catch (e) {
      toast.error((e as ApiError).message);
      setPaying(null);
    }
  }

  if (!apiConfigured()) return <Card><EmptyState icon={<WalletIcon />} title="SMS wallet not connected" description="Deploy the CWC Worker with your ProfJero Connect API key to see your balance and top up." /></Card>;

  const low = wallet && (wallet.lowBalanceThreshold != null ? wallet.availableUnits <= wallet.lowBalanceThreshold : wallet.availableUnits < 200);

  return (
    <div className="space-y-4">
      {error && <Banner tone="danger" icon={<AlertTriangle />} action={<Button size="xs" variant="outline" onClick={load}>Retry</Button>}>{error}</Banner>}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Available units" value={wallet ? num(wallet.availableUnits) : '—'} hint={wallet ? `updated ${relative(wallet.updatedAt)}` : ''} icon={<WalletIcon />} tone={low ? 'danger' : 'brand'} loading={loading && !wallet} />
        <Stat label="Reserved" value={wallet ? num(wallet.reservedUnits) : '—'} hint="held for messages in flight" tone="info" loading={loading && !wallet} />
        <Stat label="Unit price" value={unitPrice ? cedis(unitPrice) : '—'} hint="per SMS page" tone="gold" loading={loading && !pricing} />
        <Stat label="≈ Messages left" value={wallet ? num(wallet.availableUnits) : '—'} hint="single-page SMS" tone="success" loading={loading && !wallet} />
      </div>
      {low && <Banner tone="warning" icon={<AlertTriangle />} title="Your SMS balance is running low">Top up now so Sunday reminders and receipts keep going out.</Banner>}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Top up" description="Pay with Mobile Money or card through ProfJero Connect. Units are added automatically." action={<Button size="icon-sm" variant="ghost" aria-label="Refresh" icon={<RefreshCw />} onClick={load} />} />
          <div className="space-y-4 px-5 pb-5">
            <div className="grid gap-2 sm:grid-cols-2">
              {(pricing?.packages ?? []).map((p) => (
                <button key={p.id} type="button" onClick={() => setChoice(p.id)} className={cn('rounded-xl border p-3 text-left transition-colors', choice === p.id ? 'border-brand-500 bg-accent-soft ring-1 ring-brand-500' : 'border-line hover:border-line-strong')}>
                  <div className="flex items-center justify-between"><span className="text-sm font-semibold capitalize">{p.name ?? p.id}</span>{choice === p.id && <CheckCircle2 className="size-4 text-accent" />}</div>
                  <div className="mt-1 text-lg font-semibold">{num(p.units)} <span className="text-sm font-normal text-fg-3">units</span></div>
                  <div className="text-sm text-fg-2">{cedis(pkgPrice(p))}</div>
                </button>
              ))}
              <button type="button" onClick={() => setChoice('custom')} className={cn('rounded-xl border p-3 text-left', choice === 'custom' ? 'border-brand-500 bg-accent-soft ring-1 ring-brand-500' : 'border-line hover:border-line-strong')}>
                <div className="text-sm font-semibold">Custom amount</div>
                <div className="mt-1 text-sm text-fg-3">{unitPrice ? `${cedis(unitPrice)} per unit` : 'Any number of units'}</div>
              </button>
            </div>
            {choice === 'custom' && (
              <Field label="Units to buy" hint={unitPrice && Number(customUnits) ? `≈ ${cedis(Number(customUnits) * unitPrice)}` : undefined}>
                <Input type="number" inputMode="numeric" min="1" value={customUnits} onChange={(e) => setCustomUnits(e.target.value)} />
              </Field>
            )}
            <TextField label="Receipt email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" icon={<Smartphone />} onClick={() => topUp('mobile_money')} loading={paying === 'mobile_money'} disabled={!!paying}>Pay with MoMo</Button>
              <Button className="flex-1" variant="outline" icon={<CreditCard />} onClick={() => topUp('card')} loading={paying === 'card'} disabled={!!paying}>Pay with card</Button>
            </div>
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Recent top-ups" />
          {loading && !payments.length ? <div className="px-5 pb-5"><Spinner /></div> : payments.length === 0 ? (
            <EmptyState compact title="No top-ups yet" />
          ) : (
            <ul className="divide-y divide-line">
              {payments.map((p) => (
                <li key={p.reference} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="min-w-0"><span className="block font-medium">{num(p.units)} units · {cedis(p.amountGhs)}</span><span className="block truncate text-xs text-fg-3">{p.paidAt ? fmtDateTime(p.paidAt) : p.reference}</span></span>
                  <Badge tone={p.paidAt ? 'success' : p.status === 'failed' ? 'danger' : 'warning'}>{p.paidAt ? 'Paid' : p.status}</Badge>
                </li>
              ))}
            </ul>
          )}
          {txns.length > 0 && (
            <>
              <h4 className="border-t border-line px-5 pb-1 pt-4 text-[13px] font-semibold">Wallet activity</h4>
              <ul className="max-h-64 divide-y divide-line overflow-y-auto">
                {txns.map((t, i) => {
                  const d = t.delta ?? t.units ?? 0;
                  return (
                    <li key={t.id ?? i} className="flex justify-between gap-3 px-5 py-2 text-xs">
                      <span className="min-w-0 truncate text-fg-2">{t.description ?? t.type ?? 'Transaction'}</span>
                      <span className={cn('shrink-0 font-medium tabular', d >= 0 ? 'text-success' : 'text-fg')}>{d > 0 ? '+' : ''}{num(d)}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>
      </div>
      <p className="text-xs text-fg-3">One unit = one SMS page to one recipient. 160 characters per page for standard text; 70 when the message has emoji or symbols like ₵.</p>
    </div>
  );
}
