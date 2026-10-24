import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Phone, MessageCircle, Send, Pencil, MoreHorizontal, Trash2, Route, HeartHandshake, Printer, Users, Home, Plus, Link2Off, CalendarCheck2, HandCoins } from 'lucide-react';
import { toast } from 'sonner';
import { doc, writeBatch } from 'firebase/firestore';
import { useAuth } from '@/lib/auth';
import { useGroups, useHouseholdMembers, useMember, useMemberAttendance, useMemberCareLogs, useMemberGifts, useMemberPledges, useServices } from '@/lib/queries';
import { formatPhone, telHref, whatsappHref } from '@/lib/phone';
import { age, cedis, fmtDate, isoDate, relative } from '@/lib/format';
import { createDoc, db, patchDoc, removeDoc, audit } from '@/lib/db';
import { printDocument, escapeHtml } from '@/lib/print';
import { useChurch } from '@/lib/settings';
import { sum, titleCase, uid } from '@/lib/utils';
import { Page } from '@/components/ui/page';
import { Card, CardHeader, Stat } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink, buttonClass } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DescriptionList } from '@/components/ui/page';
import { EmptyState, FullPageLoader } from '@/components/ui/feedback';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { useConfirm } from '@/components/ui/confirm';
import { Modal } from '@/components/ui/dialog';
import { MemberPicker } from '@/components/member-picker';
import { Field, Select } from '@/components/ui/input';
import { useDocumentTitle } from '@/lib/hooks';
import { PersonForm, STATUS_META } from './shared';
import { SMS_SELECTION_KEY } from './People';
import { CareLogForm } from '@/features/admin/care/CareLogForm';
import type { HouseholdRole, Member } from '@/lib/types';

export default function PersonDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { data: m, loading } = useMember(id);
  const [edit, setEdit] = useState(false);
  const [careOpen, setCareOpen] = useState(false);
  useDocumentTitle(m?.fullName ?? 'Person');

  if (loading) return <FullPageLoader />;
  if (!m)
    return (
      <Page>
        <EmptyState icon={<Users />} title="Person not found" description="They may have been removed." action={<ButtonLink to="/admin/people">Back to people</ButtonLink>} />
      </Page>
    );

  const status = STATUS_META[m.membershipStatus];

  async function del() {
    if (!(await confirm({ title: `Delete ${m!.fullName}?`, description: 'This removes their profile from the directory. Giving and attendance records are kept for reporting.', confirmLabel: 'Delete', danger: true }))) return;
    await removeDoc('members', m!.id, { audit: `Deleted ${m!.fullName}` });
    toast.success('Deleted');
    navigate('/admin/people', { replace: true });
  }

  async function followUp() {
    await createDoc('followups', { memberId: m!.id, name: m!.fullName, phone: m!.phone, kind: 'pastoral', stage: 'new', assignedTo: null, assignedName: '', dueDate: isoDate(new Date(Date.now() + 3 * 864e5)), notes: [] });
    toast.success('Added to follow-ups', { action: { label: 'Open', onClick: () => navigate('/admin/follow-ups') } });
  }

  function sms() {
    sessionStorage.setItem(SMS_SELECTION_KEY, JSON.stringify([m!.id]));
    navigate('/admin/messages?compose=1&audience=selection');
  }

  return (
    <Page>
      <Link to="/admin/people" className="mb-4 inline-flex items-center gap-1 text-[13px] font-medium text-fg-3 hover:text-fg">
        ← People
      </Link>
      <Card className="overflow-hidden">
        <div className="h-20 bg-[linear-gradient(120deg,var(--color-brand-800),var(--color-brand-600)_60%,var(--color-gold-500))] opacity-90 sm:h-24" />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:px-6">
          <Avatar name={m.fullName} src={m.photoUrl} size="xl" className="-mt-10 ring-4 ring-surface" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {m.title && <span className="font-normal text-fg-3">{m.title} </span>}
                {m.fullName}
              </h1>
              <Badge tone={status?.tone}>{status?.label}</Badge>
              {m.uid && <Badge tone="info">Has app</Badge>}
            </div>
            <p className="mt-1 text-sm text-fg-3">
              {[formatPhone(m.phone), m.occupation, m.address].filter(Boolean).join(' · ') || 'No contact details yet'}
            </p>
            {m.tags?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {m.tags.map((t) => (
                  <span key={t} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-fg-2">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {m.phone && (
              <>
                <a href={telHref(m.phone)} className={buttonClass('outline', 'sm')}>
                  <Phone /> Call
                </a>
                <a href={whatsappHref(m.phone)} target="_blank" rel="noreferrer" className={buttonClass('outline', 'sm')}>
                  <MessageCircle /> WhatsApp
                </a>
                {can('messaging.sms') && (
                  <Button size="sm" variant="outline" icon={<Send />} onClick={sms}>
                    SMS
                  </Button>
                )}
              </>
            )}
            {can('people.manage') && (
              <Button size="sm" icon={<Pencil />} onClick={() => setEdit(true)}>
                Edit
              </Button>
            )}
            <Menu>
              <MenuTrigger asChild>
                <Button size="icon-sm" variant="outline" aria-label="More actions" icon={<MoreHorizontal />} />
              </MenuTrigger>
              <MenuContent>
                {can('followups.manage') && (
                  <MenuItem icon={<Route />} onSelect={followUp}>
                    Add to follow-ups
                  </MenuItem>
                )}
                {can('care.view') && (
                  <MenuItem icon={<HeartHandshake />} onSelect={() => setCareOpen(true)}>
                    Log pastoral care
                  </MenuItem>
                )}
                {can('people.delete') && (
                  <>
                    <MenuSeparator />
                    <MenuItem icon={<Trash2 />} danger onSelect={del}>
                      Delete person
                    </MenuItem>
                  </>
                )}
              </MenuContent>
            </Menu>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          {can('giving.view') && <TabsTrigger value="giving">Giving</TabsTrigger>}
          {can('care.view') && <TabsTrigger value="care">Care</TabsTrigger>}
          <TabsTrigger value="family">Family</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-5">
          <Overview m={m} />
        </TabsContent>
        <TabsContent value="attendance" className="mt-5">
          <AttendanceTab m={m} />
        </TabsContent>
        {can('giving.view') && (
          <TabsContent value="giving" className="mt-5">
            <GivingTab m={m} />
          </TabsContent>
        )}
        {can('care.view') && (
          <TabsContent value="care" className="mt-5">
            <CareTab m={m} onLog={() => setCareOpen(true)} />
          </TabsContent>
        )}
        <TabsContent value="family" className="mt-5">
          <FamilyTab m={m} />
        </TabsContent>
      </Tabs>

      <PersonForm open={edit} onOpenChange={setEdit} member={m} />
      {can('care.view') && <CareLogForm open={careOpen} onOpenChange={setCareOpen} member={{ id: m.id, name: m.fullName }} />}
    </Page>
  );
}

function Overview({ m }: { m: Member }) {
  const { data: groups } = useGroups();
  const mine = groups.filter((g) => m.groupIds?.includes(g.id));
  const a = age(m.dob);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Personal details" />
        <div className="px-5 pb-5">
          <DescriptionList
            items={[
              { label: 'Gender', value: m.gender ? titleCase(m.gender) : '' },
              { label: 'Date of birth', value: m.dob ? `${fmtDate(m.dob)}${a !== null ? ` (${a})` : ''}` : '' },
              { label: 'Phone', value: formatPhone(m.phone) },
              { label: 'Alternative phone', value: formatPhone(m.altPhone) },
              { label: 'Email', value: m.email },
              { label: 'Occupation', value: m.occupation },
              { label: 'Address', value: m.address },
              { label: 'GhanaPost GPS', value: m.gpsAddress },
              { label: 'Hometown', value: [m.hometown, m.region].filter(Boolean).join(', ') },
              { label: 'Marital status', value: m.maritalStatus ? titleCase(m.maritalStatus) : '' },
              ...(m.anniversary ? [{ label: 'Wedding anniversary', value: fmtDate(m.anniversary, 'd MMMM') }] : []),
            ]}
          />
        </div>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader title="Church life" />
          <div className="px-5 pb-5">
            <DescriptionList
              className="sm:grid-cols-1"
              items={[
                { label: 'Joined / first visit', value: fmtDate(m.joinDate) },
                { label: 'Water baptism', value: m.baptismDate ? fmtDate(m.baptismDate) : 'Not recorded' },
                ...(m.howHeard ? [{ label: 'Heard about us via', value: m.howHeard + (m.invitedBy ? ` (invited by ${m.invitedBy})` : '') }] : []),
                {
                  label: 'Groups',
                  value: mine.length ? (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {mine.map((g) => (
                        <Link key={g.id} to={`/admin/groups/${g.id}`} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-fg-2 hover:bg-surface-3">
                          {g.name}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    ''
                  ),
                },
              ]}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Emergency contact" />
          <div className="px-5 pb-5 text-sm">
            {m.emergencyName || m.emergencyPhone ? (
              <>
                <div className="font-medium">{m.emergencyName || '—'}</div>
                <div className="text-fg-3">
                  {[m.emergencyRelation, formatPhone(m.emergencyPhone)].filter(Boolean).join(' · ')}
                </div>
              </>
            ) : (
              <span className="text-fg-3">Not provided</span>
            )}
          </div>
        </Card>
        {m.notes && (
          <Card>
            <CardHeader title="Notes" />
            <p className="whitespace-pre-wrap px-5 pb-5 text-sm text-fg-2">{m.notes}</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function AttendanceTab({ m }: { m: Member }) {
  const { data: records, loading } = useMemberAttendance(m.id);
  const { data: services } = useServices(true, 60);
  const sundays = useMemo(() => [...new Set(services.filter((s) => new Date(s.date).getDay() === 0).map((s) => s.date))].slice(0, 10), [services]);
  const attendedDates = new Set(records.map((r) => r.date));
  const attended = sundays.filter((d) => attendedDates.has(d)).length;
  const last = records[0];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Last 10 Sundays" value={sundays.length ? `${attended}/${sundays.length}` : '—'} hint="services attended" icon={<CalendarCheck2 />} loading={loading} />
        <Stat label="Attendance rate" value={sundays.length ? `${Math.round((attended / sundays.length) * 100)}%` : '—'} tone="info" loading={loading} />
        <Stat label="Last seen" value={last ? fmtDate(last.date, 'd MMM') : 'Never'} hint={last ? relative(last.date) : 'no check-ins yet'} tone="gold" loading={loading} />
      </div>
      {sundays.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Recent Sundays</h3>
          <div className="flex flex-wrap gap-2">
            {[...sundays].reverse().map((d) => (
              <div key={d} className="flex flex-col items-center gap-1">
                <span className={`grid size-9 place-items-center rounded-lg text-xs font-semibold ${attendedDates.has(d) ? 'bg-success-soft text-success' : 'bg-surface-2 text-fg-3'}`}>
                  {attendedDates.has(d) ? '✓' : '–'}
                </span>
                <span className="text-[10px] text-fg-3">{fmtDate(d, 'd MMM')}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card>
        <CardHeader title="Check-ins" />
        {records.length === 0 ? (
          <EmptyState compact title="No check-ins recorded" />
        ) : (
          <ul className="divide-y divide-line">
            {records.slice(0, 30).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span>{r.serviceType}</span>
                <span className="text-fg-3">
                  {fmtDate(r.date)} · {r.method === 'self' ? 'self check-in' : r.method === 'qr' ? 'QR' : 'usher'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function GivingTab({ m }: { m: Member }) {
  const { data: gifts, loading } = useMemberGifts(m.id);
  const { data: pledges } = useMemberPledges(m.id);
  const church = useChurch();
  const year = new Date().getFullYear();
  const [statementYear, setStatementYear] = useState(String(year));
  const ytd = sum(gifts.filter((g) => g.date.startsWith(String(year))), (g) => g.amount);
  const tithe = sum(gifts.filter((g) => g.date.startsWith(String(year)) && g.category === 'Tithe'), (g) => g.amount);
  const months = new Set(gifts.filter((g) => g.date.startsWith(String(year)) && g.category === 'Tithe').map((g) => g.date.slice(0, 7))).size;

  function statement() {
    const list = gifts.filter((g) => g.date.startsWith(statementYear)).sort((a, b) => a.date.localeCompare(b.date));
    const rows = list.map((g) => `<tr><td>${escapeHtml(fmtDate(g.date))}</td><td>${escapeHtml(g.category)}</td><td>${escapeHtml(g.receiptNo)}</td><td>${escapeHtml(titleCase(g.method))}</td><td class="num">${escapeHtml(cedis(g.amount))}</td></tr>`).join('');
    printDocument(
      `Giving statement ${statementYear} — ${m.fullName}`,
      `<div class="head"><div><h1>${escapeHtml(church.name)}</h1><div class="muted">${escapeHtml([church.address, church.phone && formatPhone(church.phone), church.email].filter(Boolean).join(' · '))}</div></div><div style="text-align:right"><strong>Giving statement</strong><div class="muted">Year ${escapeHtml(statementYear)}</div></div></div>
      <p><strong>${escapeHtml(m.fullName)}</strong><br><span class="muted">${escapeHtml(formatPhone(m.phone))}</span></p>
      <table><thead><tr><th>Date</th><th>Category</th><th>Receipt</th><th>Method</th><th class="num">Amount</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="muted">No giving recorded for this year.</td></tr>'}</tbody>
      <tfoot><tr class="total"><td colspan="4">Total</td><td class="num">${escapeHtml(cedis(sum(list, (g) => g.amount)))}</td></tr></tfoot></table>
      <p class="muted" style="margin-top:24px">Thank you for your faithful giving. “God loves a cheerful giver.” — 2 Corinthians 9:7</p>`,
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label={`Total ${year}`} value={cedis(ytd)} icon={<HandCoins />} tone="gold" loading={loading} />
        <Stat label={`Tithe ${year}`} value={cedis(tithe)} hint={`${months} of ${new Date().getMonth() + 1} months`} loading={loading} />
        <Stat label="Last gift" value={gifts[0] ? cedis(gifts[0].amount) : '—'} hint={gifts[0] ? `${gifts[0].category} · ${fmtDate(gifts[0].date)}` : 'none yet'} tone="info" loading={loading} />
      </div>
      {pledges.length > 0 && (
        <Card>
          <CardHeader title="Pledges" />
          <ul className="divide-y divide-line">
            {pledges.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="min-w-0 truncate">{p.campaignName}</span>
                <span className="shrink-0 tabular text-fg-2">
                  {cedis(p.paid)} / {cedis(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <CardHeader
          title="Giving history"
          action={
            <div className="flex items-center gap-2">
              <Select value={statementYear} onChange={(e) => setStatementYear(e.target.value)} className="h-8 w-24 text-xs" aria-label="Statement year">
                {[year, year - 1, year - 2].map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </Select>
              <Button size="sm" variant="outline" icon={<Printer />} onClick={statement}>
                Statement
              </Button>
            </div>
          }
        />
        {gifts.length === 0 ? (
          <EmptyState compact title="No giving recorded" />
        ) : (
          <ul className="divide-y divide-line">
            {gifts.slice(0, 40).map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium">{g.category}</span>
                  <span className="block text-xs text-fg-3">
                    {fmtDate(g.date)} · {titleCase(g.method)} · {g.receiptNo}
                  </span>
                </span>
                <span className="shrink-0 font-medium tabular">{cedis(g.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function CareTab({ m, onLog }: { m: Member; onLog: () => void }) {
  const { data: logs } = useMemberCareLogs(m.id);
  return (
    <Card>
      <CardHeader title="Pastoral care log" description="Visible to pastors and administrators only" action={<Button size="sm" icon={<Plus />} onClick={onLog}>Log care</Button>} />
      {logs.length === 0 ? (
        <EmptyState compact icon={<HeartHandshake />} title="No care logged yet" description="Record visits, calls and counselling sessions here." />
      ) : (
        <ol className="space-y-0 px-5 pb-5">
          {logs.map((l) => (
            <li key={l.id} className="relative border-l border-line pb-5 pl-5 last:pb-0">
              <span className="absolute -left-1.5 top-1 size-3 rounded-full border-2 border-surface bg-brand-500" />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{titleCase(l.type)}</span>
                <span className="text-fg-3">· {fmtDate(l.date)} · {l.byName}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-fg-2">{l.summary}</p>
              {l.nextStep && <p className="mt-1 text-xs text-fg-3">Next: {l.nextStep}</p>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function FamilyTab({ m }: { m: Member }) {
  const { can } = useAuth();
  const { data: family } = useHouseholdMembers(m.householdId);
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<{ id: string | null; name: string; member?: Member } | null>(null);
  const [role, setRole] = useState<HouseholdRole>('spouse');
  const [myRole, setMyRole] = useState<HouseholdRole>(m.householdRole || 'head');
  const [busy, setBusy] = useState(false);

  async function link() {
    if (!pick?.member) return;
    setBusy(true);
    try {
      const hid = m.householdId || pick.member.householdId || uid('hh-');
      const b = writeBatch(db);
      if (!m.householdId && !pick.member.householdId) b.set(doc(db, 'households', hid), { name: `${m.lastName} household` });
      b.update(doc(db, 'members', m.id), { householdId: hid, householdRole: myRole });
      b.update(doc(db, 'members', pick.member.id), { householdId: hid, householdRole: role });
      await b.commit();
      void audit('update', 'households', hid, `Linked ${pick.member.fullName} to ${m.fullName}`);
      toast.success('Family linked');
      setOpen(false);
      setPick(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function unlink(person: Member) {
    await patchDoc('members', person.id, { householdId: null, householdRole: '' });
    toast.success(`${person.firstName} removed from household`);
  }

  return (
    <Card>
      <CardHeader
        title="Household"
        icon={<Home />}
        action={can('people.manage') && <Button size="sm" variant="outline" icon={<Plus />} onClick={() => setOpen(true)}>Link family member</Button>}
      />
      {family.length <= 1 ? (
        <EmptyState compact title="No family linked" description="Link spouses, children and relatives to see households together." />
      ) : (
        <ul className="divide-y divide-line">
          {family.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-5 py-3">
              <Avatar name={f.fullName} src={f.photoUrl} size="sm" />
              <Link to={`/admin/people/${f.id}`} className="min-w-0 flex-1 hover:underline">
                <span className="block truncate text-sm font-medium">{f.fullName}</span>
                <span className="block text-xs text-fg-3">{f.householdRole ? titleCase(f.householdRole) : 'Member'}{f.id === m.id ? ' · this person' : ''}</span>
              </Link>
              {can('people.manage') && (
                <Button size="icon-sm" variant="ghost" aria-label={`Remove ${f.firstName} from household`} icon={<Link2Off />} onClick={() => unlink(f)} />
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Link a family member"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={link} loading={busy} disabled={!pick?.member}>Link</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Family member">
            <MemberPicker value={pick} onChange={setPick} exclude={new Set([m.id])} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`${m.firstName} is`}>
              <Select value={myRole} onChange={(e) => setMyRole(e.target.value as HouseholdRole)}>
                {['head', 'spouse', 'child', 'relative', 'other'].map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
              </Select>
            </Field>
            <Field label="They are">
              <Select value={role} onChange={(e) => setRole(e.target.value as HouseholdRole)}>
                {['spouse', 'child', 'head', 'relative', 'other'].map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
              </Select>
            </Field>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

