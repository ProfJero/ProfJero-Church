import { useState } from 'react';
import { Copy, Check, Smartphone, Landmark, Wallet, Printer, Info, HandHeart } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useChurch } from '@/lib/settings';
import { useCampaigns, useMemberGifts, useMemberPledges, useMember } from '@/lib/queries';
import { copyText } from '@/lib/files';
import { cedis, fmtDate } from '@/lib/format';
import { sum } from '@/lib/utils';
import { formatPhone, normalizePhone, isValidPhone } from '@/lib/phone';
import type { PaymentAccount } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Banner, EmptyState } from '@/components/ui/feedback';
import { Meter } from '@/components/charts';
import { printDocument, escapeHtml } from '@/lib/print';
import { methodLabel } from '@/features/admin/giving/shared';
import { MemberPage, SectionTitle } from './ui';

function AccountCard({ a }: { a: PaymentAccount }) {
  const [copied, setCopied] = useState(false);
  const display = a.kind === 'momo' && isValidPhone(a.number) ? formatPhone(a.number) : a.number;
  async function copy() {
    await copyText(a.kind === 'momo' && isValidPhone(a.number) ? '0' + normalizePhone(a.number).slice(3) : a.number);
    setCopied(true);
    navigator.vibrate?.(10);
    toast.success('Number copied');
    setTimeout(() => setCopied(false), 2000);
  }
  const momo = a.kind === 'momo';
  return (
    <div className="card overflow-hidden">
      <div className={`flex items-center gap-3 px-4 py-3 ${momo ? 'bg-gold-50 dark:bg-gold-500/10' : 'bg-accent-soft'}`}>
        <span className={`grid size-9 place-items-center rounded-xl ${momo ? 'bg-gold-500 text-white' : 'bg-brand-800 text-white'}`}>{momo ? <Smartphone className="size-5" /> : <Landmark className="size-5" />}</span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{a.label}</p>
          <p className="truncate text-xs text-fg-2">{a.name}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <span className="font-mono text-xl font-semibold tracking-wide tabular">{display}</span>
        <Button size="sm" variant={copied ? 'soft' : 'outline'} icon={copied ? <Check /> : <Copy />} onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
      </div>
      {a.extra && <p className="border-t border-line px-4 py-2.5 text-xs text-fg-3">{a.extra}</p>}
    </div>
  );
}

export default function Give() {
  const church = useChurch();
  const { profile } = useAuth();
  const memberId = profile?.memberId;
  const { data: member } = useMember(memberId);
  const { data: gifts, loading } = useMemberGifts(memberId);
  const { data: pledges } = useMemberPledges(memberId);
  const { data: campaigns } = useCampaigns();
  const year = new Date().getFullYear();
  const ytd = gifts.filter((g) => g.date.startsWith(String(year)));
  const accounts = church.paymentAccounts ?? [];

  function statement() {
    const rows = ytd.slice().reverse().map((g) => `<tr><td>${escapeHtml(fmtDate(g.date))}</td><td>${escapeHtml(g.category)}</td><td>${escapeHtml(g.receiptNo)}</td><td>${escapeHtml(methodLabel(g.method))}</td><td class="num">${escapeHtml(cedis(g.amount))}</td></tr>`).join('');
    printDocument(`My giving ${year}`, `<div class="head"><div><h1>${escapeHtml(church.name)}</h1><div class="muted">Giving statement ${year}</div></div></div><p><strong>${escapeHtml(member?.fullName ?? profile?.fullName ?? '')}</strong></p><table><thead><tr><th>Date</th><th>Category</th><th>Receipt</th><th>Method</th><th class="num">Amount</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="total"><td colspan="4">Total</td><td class="num">${escapeHtml(cedis(sum(ytd, (g) => g.amount)))}</td></tr></tfoot></table>`);
  }

  return (
    <MemberPage title="Give" subtitle="“Each of you should give what you have decided in your heart to give.” — 2 Cor. 9:7">
      {accounts.length === 0 ? (
        <Card><EmptyState icon={<HandHeart />} title="Giving details coming soon" description="The church office will add Mobile Money and bank details here." /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">{accounts.map((a, i) => <AccountCard key={i} a={a} />)}</div>
      )}

      {accounts.some((a) => a.kind === 'momo') && (
        <Card className="mt-4 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Info className="size-4 text-fg-3" />How to give with Mobile Money</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-fg-2">
            <li>Dial your network’s MoMo code (MTN <b>*170#</b>, Telecel <b>*110#</b>, AT <b>*110#</b>) or open your MoMo app.</li>
            <li>Choose <b>Transfer Money</b> or <b>Pay merchant</b> and enter the number above.</li>
            <li>For the reference, write what it’s for and your name — e.g. <b>Tithe Ama Mensah</b>.</li>
            <li>Keep the confirmation SMS. The church will record it and you’ll see it below.</li>
          </ol>
        </Card>
      )}

      <SectionTitle>My giving</SectionTitle>
      {!memberId ? (
        <Banner tone="brand" icon={<Wallet />}>Your giving history appears here once the church office links your app account to your member record. Mention it at the office or to your cell leader.</Banner>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4"><p className="text-xs text-fg-3">Given in {year}</p><p className="mt-1 text-xl font-semibold">{cedis(sum(ytd, (g) => g.amount))}</p></Card>
            <Card className="p-4"><p className="text-xs text-fg-3">Tithe months</p><p className="mt-1 text-xl font-semibold">{new Set(ytd.filter((g) => g.category === 'Tithe').map((g) => g.date.slice(0, 7))).size} <span className="text-sm font-normal text-fg-3">of {new Date().getMonth() + 1}</span></p></Card>
          </div>
          {pledges.length > 0 && (
            <div className="mt-3 space-y-2">
              {pledges.map((p) => (
                <Card key={p.id} className="p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm"><span className="font-medium">{p.campaignName}</span><span className="whitespace-nowrap tabular text-fg-2">{cedis(p.paid, { compact: true })} of {cedis(p.amount, { compact: true })}</span></div>
                  <Meter value={p.paid} max={p.amount} className="mt-2" />
                  <p className="mt-1.5 text-xs text-fg-3">{p.paid >= p.amount ? 'Pledge fulfilled — thank you!' : `Balance ${cedis(p.amount - p.paid)}${p.dueDate ? ` · by ${fmtDate(p.dueDate)}` : ''}`}</p>
                </Card>
              ))}
            </div>
          )}
          <Card className="mt-3">
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <h3 className="text-sm font-semibold">Recent gifts</h3>
              {ytd.length > 0 && <Button size="sm" variant="ghost" icon={<Printer />} onClick={statement}>Statement</Button>}
            </div>
            {loading ? null : gifts.length === 0 ? <EmptyState compact title="No gifts recorded yet" /> : (
              <ul className="divide-y divide-line">
                {gifts.slice(0, 15).map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="min-w-0"><span className="block text-sm font-medium">{g.category}</span><span className="block text-xs text-fg-3">{fmtDate(g.date)} · {methodLabel(g.method)}</span></span>
                    <span className="shrink-0 font-semibold tabular">{cedis(g.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {campaigns.filter((c) => c.isActive).length > 0 && (
        <>
          <SectionTitle>Church projects</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {campaigns.filter((c) => c.isActive).map((c) => (
              <Card key={c.id} className="p-4">
                <h3 className="font-semibold">{c.name}</h3>
                {c.description && <p className="mt-1 text-sm text-fg-2">{c.description}</p>}
                <p className="mt-2 text-xs text-fg-3">Goal {cedis(c.goal, { compact: true })}{c.endDate ? ` · by ${fmtDate(c.endDate)}` : ''}</p>
              </Card>
            ))}
          </div>
        </>
      )}
    </MemberPage>
  );
}
