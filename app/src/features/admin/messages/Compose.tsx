import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Send, Wand2, CalendarClock, Users, AlertTriangle, Calculator, Smartphone, Check, X } from 'lucide-react';
import { subDays } from 'date-fns';
import { toast } from 'sonner';
import { useGroups, useMembers, useSmsTemplates } from '@/lib/queries';
import { useChurch } from '@/lib/settings';
import { formatPhone, isValidPhone, normalizePhone } from '@/lib/phone';
import { MESSAGE_FIELDS, missingFields, renderMessage, segmentInfo, toGsmSafe } from '@/lib/sms';
import { isoDate, num, fmtDateTime } from '@/lib/format';
import { upcomingBirthdays, ACTIVE_STATUSES } from '@/lib/stats';
import { api, ApiError, apiConfigured } from '@/lib/api';
import { uid } from '@/lib/utils';
import type { Member } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/input';
import { Banner } from '@/components/ui/feedback';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/dialog';
import { estimateSms, sendSms, type PjEstimate, type Recipient } from './sms-client';
import { SMS_SELECTION_KEY } from '../people/People';

type AudienceKind = 'active' | 'workers' | 'first_timers' | 'group' | 'birthdays_today' | 'birthdays_week' | 'everyone' | 'selection' | 'manual';

const AUDIENCES: { value: AudienceKind; label: string }[] = [
  { value: 'active', label: 'All active members' },
  { value: 'workers', label: 'Workers & leaders' },
  { value: 'first_timers', label: 'First-timers (last 30 days)' },
  { value: 'group', label: 'A group or ministry' },
  { value: 'birthdays_today', label: 'Birthdays today' },
  { value: 'birthdays_week', label: 'Birthdays this week' },
  { value: 'everyone', label: 'Everyone in the directory' },
  { value: 'selection', label: 'People I selected' },
  { value: 'manual', label: 'Type or paste numbers' },
];

const PRESETS: Record<string, string> = {
  absentee: 'Hi {first_name|Beloved}, we have missed you in church recently. We are praying for you and would love to see you this Sunday. God bless you.',
  pledge: 'Dear {first_name|Beloved}, thank you for your pledge towards the {campaign|building project}. Your outstanding balance is GHS {balance}. God bless you as you redeem it.',
  birthday: '',
};

interface PledgeField { memberId: string; balance: string; campaign: string }

export function Compose({ onSent }: { onSent: () => void }) {
  const church = useChurch();
  const [params] = useSearchParams();
  const { data: members } = useMembers();
  const { data: groups } = useGroups();
  const { data: templates } = useSmsTemplates();

  const initialAudience = (params.get('audience') === 'birthdays' ? 'birthdays_today' : (params.get('audience') as AudienceKind)) || 'active';
  const [audience, setAudience] = useState<AudienceKind>(AUDIENCES.some((a) => a.value === initialAudience) ? initialAudience : 'active');
  const [groupId, setGroupId] = useState('');
  const [manual, setManual] = useState('');
  const [selection] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(SMS_SELECTION_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [pledgeFields] = useState<PledgeField[]>(() => {
    try {
      return params.get('template') === 'pledge' ? JSON.parse(sessionStorage.getItem('cwc-sms-pledges') || '[]') : [];
    } catch {
      return [];
    }
  });

  const [message, setMessage] = useState(() => {
    const t = params.get('template');
    if (t && PRESETS[t]) return PRESETS[t];
    if (params.get('audience') === 'birthdays') return church.birthdaySms ?? '';
    return '';
  });
  const [signature, setSignature] = useState(true);
  const [senderId, setSenderId] = useState('');
  const [senderIds, setSenderIds] = useState<string[]>([]);
  const [schedule, setSchedule] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [estimate, setEstimate] = useState<PjEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [key, setKey] = useState(() => `cwc-${uid()}`);

  useEffect(() => {
    if (!senderId && church.smsSenderId) setSenderId(church.smsSenderId);
  }, [church.smsSenderId, senderId]);

  useEffect(() => {
    if (!apiConfigured()) return;
    api<{ senderIds: { senderId: string; status: string }[] }>('/v1/sms/sender-ids')
      .then((r) => {
        const ok = r.senderIds.filter((s) => s.status === 'approved').map((s) => s.senderId);
        setSenderIds(ok);
        setSenderId((cur) => cur || ok[0] || '');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (params.get('audience') === 'birthdays' && !message && church.birthdaySms) setMessage(church.birthdaySms);
  }, [church.birthdaySms, params, message]);

  const groupName = useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups]);

  const people: Member[] = useMemo(() => {
    const reachable = (m: Member) => m.phone && !m.smsOptOut && !['deceased', 'transferred'].includes(m.membershipStatus);
    const since = isoDate(subDays(new Date(), 30));
    switch (audience) {
      case 'active': return members.filter((m) => reachable(m) && ACTIVE_STATUSES.includes(m.membershipStatus) && m.membershipStatus !== 'first_timer');
      case 'workers': return members.filter((m) => reachable(m) && ['worker', 'leader'].includes(m.membershipStatus));
      case 'first_timers': return members.filter((m) => reachable(m) && m.membershipStatus === 'first_timer' && (m.joinDate ?? '') >= since);
      case 'group': return members.filter((m) => reachable(m) && groupId && m.groupIds?.includes(groupId));
      case 'birthdays_today': return upcomingBirthdays(members, 1).map((b) => b.member).filter(reachable);
      case 'birthdays_week': return upcomingBirthdays(members, 7).map((b) => b.member).filter(reachable);
      case 'everyone': return members.filter(reachable);
      case 'selection': return members.filter((m) => selection.includes(m.id) && reachable(m));
      default: return [];
    }
  }, [audience, members, groupId, selection]);

  const manualNumbers = useMemo(() => {
    const parts = manual.split(/[\s,;]+/).filter(Boolean);
    return { valid: [...new Set(parts.filter(isValidPhone).map(normalizePhone))], invalid: parts.filter((p) => !isValidPhone(p)) };
  }, [manual]);

  const pledgeByMember = useMemo(() => new Map(pledgeFields.map((p) => [p.memberId, p])), [pledgeFields]);

  const fullMessage = signature && church.smsSignature && message.trim() && !message.includes(church.smsSignature) ? `${message.trim()} ${church.smsSignature}` : message.trim();

  const recipients: Recipient[] = useMemo(() => {
    if (audience === 'manual') return manualNumbers.valid;
    return people.map((m) => {
      const p = pledgeByMember.get(m.id);
      const fields: Record<string, string> = {
        first_name: m.firstName,
        last_name: m.lastName,
        name: m.fullName,
        title: m.title ?? '',
        phone: formatPhone(m.phone),
        group: groupId ? groupName.get(groupId) ?? '' : '',
      };
      if (p) {
        fields.balance = p.balance;
        fields.campaign = p.campaign;
      }
      return { phone: m.phone, fields };
    });
  }, [audience, manualNumbers.valid, people, pledgeByMember, groupId, groupName]);

  const seg = segmentInfo(renderMessage(fullMessage, { first_name: 'Akosua', last_name: 'Mensah', name: 'Akosua Mensah', title: 'Sis.', group: 'Choir', balance: '1500.00', campaign: 'Building Project' }));
  const sample = recipients[0];
  const sampleFields = typeof sample === 'object' ? sample.fields ?? {} : {};
  const preview = renderMessage(fullMessage, sampleFields);
  const missing = useMemo(() => {
    const all = new Set<string>();
    for (const r of recipients.slice(0, 2000)) missingFields(fullMessage, typeof r === 'object' ? r.fields ?? {} : {}).forEach((f) => all.add(f));
    return [...all];
  }, [recipients, fullMessage]);
  const roughUnits = recipients.length * Math.max(1, seg.pages);
  const audienceLabel =
    audience === 'group' ? `Group — ${groupName.get(groupId) ?? ''}` : audience === 'selection' ? params.get('label') || `${selection.length} selected people` : AUDIENCES.find((a) => a.value === audience)?.label ?? '';

  // Any change invalidates the estimate and gets a fresh idempotency key
  useEffect(() => {
    setEstimate(null);
    setKey(`cwc-${uid()}`);
  }, [fullMessage, recipients.length, audience, schedule, scheduleAt]);

  function insertField(f: { key: string; fallback: string }) {
    setMessage((m) => `${m}${m && !m.endsWith(' ') ? ' ' : ''}{${f.key}${f.fallback ? `|${f.fallback}` : ''}}`);
  }

  async function runEstimate() {
    if (!fullMessage || !recipients.length) return;
    setEstimating(true);
    try {
      setEstimate(await estimateSms(fullMessage, recipients));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not estimate cost');
    } finally {
      setEstimating(false);
    }
  }

  async function send() {
    setSending(true);
    try {
      const at = schedule && scheduleAt ? new Date(scheduleAt).toISOString() : null;
      const res = await sendSms({ message: fullMessage, recipients, audience: audienceLabel, senderId: senderId || undefined, scheduleAt: at, idempotencyKey: key });
      if (res.scheduled) toast.success(`Scheduled for ${fmtDateTime(at)} · ${num(recipients.length)} recipients`);
      else toast.success(`Sending to ${num(res.batch?.totalRecipients ?? recipients.length)} people`, { description: `${num(res.batch?.totalUnitsReserved)} units reserved` });
      setConfirming(false);
      setMessage('');
      sessionStorage.removeItem(SMS_SELECTION_KEY);
      onSent();
    } catch (e) {
      const err = e as ApiError;
      toast.error(err.status === 402 ? 'Not enough SMS units — top up your wallet in the Wallet tab.' : err.message, { description: err.requestId ? `Ref ${err.requestId}` : undefined });
    } finally {
      setSending(false);
    }
  }

  const canSend = !!fullMessage && recipients.length > 0 && missing.length === 0 && (!schedule || !!scheduleAt) && apiConfigured();

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        {!apiConfigured() && <Banner tone="warning" icon={<AlertTriangle />} title="SMS isn’t connected yet">Deploy the CWC Worker and set VITE_API_URL to send through ProfJero Connect. You can still draft messages and templates.</Banner>}

        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold"><Users className="size-4 text-fg-3" /> Who should receive it?</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Audience">
              <Select value={audience} onChange={(e) => setAudience(e.target.value as AudienceKind)}>
                {AUDIENCES.filter((a) => a.value !== 'selection' || selection.length).map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </Select>
            </Field>
            {audience === 'group' && (
              <Field label="Group">
                <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                  <option value="">Choose a group…</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </Select>
              </Field>
            )}
          </div>
          {audience === 'manual' && (
            <Field label="Phone numbers" hint="Separate with commas, spaces or new lines. Ghana numbers like 024 123 4567 are fine." className="mt-3">
              <Textarea rows={3} value={manual} onChange={(e) => setManual(e.target.value)} placeholder="0241234567, 0551234567" />
            </Field>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={recipients.length ? 'brand' : 'neutral'}>{num(recipients.length)} recipients</Badge>
            {audience === 'manual' && manualNumbers.invalid.length > 0 && <Badge tone="danger">{manualNumbers.invalid.length} invalid</Badge>}
            {audience !== 'manual' && <span className="text-xs text-fg-3">People without a phone or who opted out are skipped automatically.</span>}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[15px] font-semibold">Message</h3>
            {templates.length > 0 && (
              <Select value="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) setMessage(t.body); }} className="h-8 w-48 text-xs" aria-label="Use a template">
                <option value="">Use a template…</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            )}
          </div>
          <Textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your message. Add fields like {first_name} to personalise it." aria-label="Message" className="text-[15px]" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...MESSAGE_FIELDS, ...(pledgeFields.length ? [{ key: 'balance', label: 'Pledge balance', fallback: '' }, { key: 'campaign', label: 'Campaign', fallback: '' }] : [])]
              .filter((f) => audience !== 'manual' || f.key === 'phone')
              .filter((f) => f.key !== 'group' || audience === 'group')
              .map((f) => (
                <button key={f.key} type="button" onClick={() => insertField(f)} className="h-7 rounded-lg border border-line px-2 text-xs font-medium text-fg-2 hover:bg-surface-2">
                  + {f.label}
                </button>
              ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-fg-3">
              <span><span className="font-semibold text-fg tabular">{seg.length}</span> chars</span>
              <span><span className="font-semibold text-fg tabular">{seg.pages}</span> {seg.pages === 1 ? 'page' : 'pages'} per person</span>
              <span>{seg.remaining} left in page</span>
              <Badge tone={seg.encoding === 'GSM-7' ? 'success' : 'warning'}>{seg.encoding === 'GSM-7' ? 'Standard text' : 'Unicode'}</Badge>
            </div>
            {church.smsSignature && <Switch checked={signature} onCheckedChange={setSignature} label={<span className="text-xs">Add “{church.smsSignature}”</span>} />}
          </div>
          {seg.encoding === 'Unicode' && (
            <Banner tone="warning" icon={<AlertTriangle />} className="mt-3" action={<Button size="xs" variant="outline" icon={<Wand2 />} onClick={() => setMessage(toGsmSafe(message))}>Fix it</Button>}>
              {seg.unicodeChars.slice(0, 6).map((c) => `“${c}”`).join(' ')} switch this to Unicode: 70 characters per page instead of 160, so it costs more. Use GHS instead of ₵ and plain quotes.
            </Banner>
          )}
          {missing.length > 0 && (
            <Banner tone="danger" icon={<X />} className="mt-3">
              Some recipients have no value for {missing.map((m) => `{${m}}`).join(', ')}. Add a fallback like <code>{`{${missing[0]}|Beloved}`}</code>.
            </Banner>
          )}
        </Card>

        <Card className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sender ID" hint={senderIds.length ? 'Approved names from ProfJero Connect' : 'Request Sender IDs in your ProfJero Connect dashboard'}>
              {senderIds.length ? (
                <Select value={senderId} onChange={(e) => setSenderId(e.target.value)}>
                  {senderIds.map((s) => <option key={s}>{s}</option>)}
                </Select>
              ) : (
                <Input value={senderId} onChange={(e) => setSenderId(e.target.value.slice(0, 11))} placeholder="e.g. CWC" maxLength={11} />
              )}
            </Field>
            <div className="space-y-3">
              <Switch checked={schedule} onCheckedChange={setSchedule} label="Schedule for later" description="Units are charged when it sends." />
              {schedule && <Input type="datetime-local" value={scheduleAt} min={new Date(Date.now() + 5 * 60e3).toISOString().slice(0, 16)} onChange={(e) => setScheduleAt(e.target.value)} aria-label="Send at" />}
            </div>
          </div>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <span className="text-sm text-fg-3 sm:mr-auto">
            {estimate ? (
              <span className={estimate.sufficient ? '' : 'font-medium text-danger'}>
                {num(estimate.units)} units · balance {num(estimate.availableUnits)} {estimate.sufficient ? '✓' : '— not enough'}
              </span>
            ) : (
              recipients.length > 0 && fullMessage && <>≈ {num(roughUnits)} units</>
            )}
          </span>
          <Button variant="outline" icon={<Calculator />} onClick={runEstimate} loading={estimating} disabled={!canSend}>Check cost</Button>
          <Button icon={schedule ? <CalendarClock /> : <Send />} onClick={() => setConfirming(true)} disabled={!canSend}>
            {schedule ? 'Schedule' : 'Send'} to {num(recipients.length)}
          </Button>
        </div>
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <PhonePreview sender={senderId || church.shortName} text={preview} who={typeof sample === 'object' ? sample.fields?.name : sample ? formatPhone(sample as string) : undefined} />
      </aside>

      <Modal
        open={confirming}
        onOpenChange={setConfirming}
        title={schedule ? 'Schedule this message?' : 'Send this message?'}
        size="sm"
        footer={<><Button variant="outline" onClick={() => setConfirming(false)}>Back</Button><Button onClick={send} loading={sending} icon={<Check />}>{schedule ? 'Schedule' : 'Send now'}</Button></>}
      >
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-fg-3">Audience</dt><dd className="text-right">{audienceLabel}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-fg-3">Recipients</dt><dd>{num(recipients.length)}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-fg-3">Units</dt><dd>{estimate ? num(estimate.units) : `≈ ${num(roughUnits)}`}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-fg-3">Sender</dt><dd>{senderId || 'Default'}</dd></div>
          {schedule && <div className="flex justify-between gap-4"><dt className="text-fg-3">Sends at</dt><dd>{fmtDateTime(scheduleAt)}</dd></div>}
        </dl>
        <p className="mt-4 rounded-xl bg-surface-2 p-3 text-sm whitespace-pre-wrap">{preview}</p>
      </Modal>
    </div>
  );
}

function PhonePreview({ sender, text, who }: { sender: string; text: string; who?: string }) {
  return (
    <div className="mx-auto w-full max-w-[320px]">
      <div className="rounded-[2.2rem] border border-line-strong bg-surface p-2.5 shadow-[var(--shadow-pop)]">
        <div className="overflow-hidden rounded-[1.7rem] bg-surface-2">
          <div className="flex flex-col items-center gap-1 border-b border-line bg-surface px-4 pb-3 pt-4">
            <span className="grid size-9 place-items-center rounded-full bg-brand-800 text-[11px] font-semibold text-white">{sender.slice(0, 3).toUpperCase()}</span>
            <span className="text-xs font-semibold">{sender}</span>
          </div>
          <div className="min-h-64 px-3 py-4">
            {text ? (
              <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-surface px-3.5 py-2.5 text-[13.5px] leading-snug whitespace-pre-wrap text-fg shadow-sm">{text}</div>
            ) : (
              <p className="pt-16 text-center text-xs text-fg-3"><Smartphone className="mx-auto mb-2 size-5" />Your message preview appears here</p>
            )}
          </div>
        </div>
      </div>
      {who && text && <p className="mt-2 text-center text-xs text-fg-3">Preview as {who}</p>}
    </div>
  );
}

