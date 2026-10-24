import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Plus, CalendarCheck2, UserX, Send, Route, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '@/lib/auth';
import { useMembers, useServices, useFollowUps } from '@/lib/queries';
import { attendanceByDate, serviceTotal, ACTIVE_STATUSES, change } from '@/lib/stats';
import { fmtDate, num, isoDate } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { createDoc, db } from '@/lib/db';
import { sum } from '@/lib/utils';
import type { Member, Service } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Stat, Card, CardHeader } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/table';
import { EmptyState, SkeletonRows } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar } from '@/components/ui/avatar';
import { Select } from '@/components/ui/input';
import { ChartCard } from '@/components/charts';
import { ServiceForm } from './ServiceForm';
import { SMS_SELECTION_KEY } from '../people/People';

export default function Attendance() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: services, loading } = useServices(true, 120);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (params.get('new') === '1') {
      setOpen(true);
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const trend = useMemo(() => attendanceByDate(services, 12), [services]);
  const last4 = trend.slice(-4);
  const prev4 = trend.slice(-8, -4);
  const avg = (a: { total: number }[]) => (a.length ? Math.round(sum(a, (x) => x.total) / a.length) : 0);
  const live = services.filter((s) => s.isOpen);
  const firstTimers = sum(services.filter((s) => s.date >= isoDate(new Date(Date.now() - 30 * 864e5))), (s) => s.firstTimers ?? s.headcount?.visitors ?? 0);
  const best = trend.reduce((m, t) => Math.max(m, t.total), 0);

  const columns: Column<Service>[] = [
    { key: 'date', header: 'Date', sort: (s) => s.date, cell: (s) => <span className="whitespace-nowrap">{fmtDate(s.date, 'EEE d MMM yyyy')}</span> },
    { key: 'title', header: 'Service', sort: (s) => s.title, cell: (s) => <span className="font-medium">{s.title}</span> },
    { key: 'total', header: 'Attendance', align: 'right', sort: serviceTotal, cell: (s) => num(serviceTotal(s)) },
    { key: 'checkins', header: 'Check-ins', align: 'right', hideBelow: 'md', sort: (s) => s.checkins ?? 0, cell: (s) => num(s.checkins) },
    { key: 'visitors', header: 'Visitors', align: 'right', hideBelow: 'lg', cell: (s) => num(s.headcount?.visitors) },
    { key: 'status', header: '', cell: (s) => (s.isOpen ? <Badge tone="success" dot>Live</Badge> : null) },
  ];

  return (
    <Page>
      <PageHeader
        title="Attendance"
        description="Services, headcounts and check-ins."
        actions={<Button size="sm" icon={<Plus />} onClick={() => setOpen(true)}>Start service</Button>}
      />

      {live.length > 0 && (
        <div className="mb-4 grid gap-2">
          {live.map((s) => (
            <button key={s.id} onClick={() => navigate(`/admin/attendance/${s.id}`)} className="flex items-center gap-3 rounded-2xl border border-success/25 bg-success-soft px-4 py-3 text-left">
              <span className="relative grid size-9 place-items-center rounded-xl bg-success text-white dark:text-black"><Radio className="size-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-success">{s.title} is live</span>
                <span className="block text-xs text-fg-2">{fmtDate(s.date, 'EEEE d MMM')} · {num(s.checkins)} checked in — tap to continue check-in</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Avg Sunday" value={num(avg(last4))} trend={change(avg(last4), avg(prev4))} hint="last 4 weeks" icon={<CalendarCheck2 />} loading={loading} />
        <Stat label="Last Sunday" value={num(trend[trend.length - 1]?.total)} hint={trend.length ? fmtDate(trend[trend.length - 1].date, 'd MMM') : ''} tone="info" loading={loading} />
        <Stat label="Best Sunday (12 wks)" value={num(best)} tone="gold" loading={loading} />
        <Stat label="Visitors (30 days)" value={num(firstTimers)} tone="success" loading={loading} />
      </div>

      <Tabs defaultValue="services" className="mt-6">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="absentees">Absentees</TabsTrigger>
        </TabsList>
        <TabsContent value="services" className="mt-4">
          <DataTable
            rows={services}
            columns={columns}
            rowKey={(s) => s.id}
            onRowClick={(s) => navigate(`/admin/attendance/${s.id}`)}
            isLoading={loading}
            loading={<SkeletonRows />}
            defaultSort={{ key: 'date', dir: 'desc' }}
            mobile={(s) => (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{s.title}</div>
                  <div className="text-[13px] text-fg-3">{fmtDate(s.date, 'EEE d MMM yyyy')}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular">{num(serviceTotal(s))}</div>
                  {s.isOpen ? <Badge tone="success" dot>Live</Badge> : <div className="text-xs text-fg-3">people</div>}
                </div>
              </div>
            )}
            empty={<EmptyState icon={<CalendarCheck2 />} title="No services yet" description="Start a service to record headcount and check-ins." action={<Button icon={<Plus />} onClick={() => setOpen(true)}>Start service</Button>} />}
          />
        </TabsContent>
        <TabsContent value="trends" className="mt-4 space-y-4">
          <ChartCard title="Sunday attendance" description="Last 12 Sundays, all services combined" data={trend} xKey="label" xLabel="Sunday" series={[{ key: 'total', label: 'Attendance' }]} kind="area" height={280} />
          <ByType services={services} />
        </TabsContent>
        <TabsContent value="absentees" className="mt-4">
          <Absentees services={services} />
        </TabsContent>
      </Tabs>
      <ServiceForm open={open} onOpenChange={setOpen} onSaved={(id) => navigate(`/admin/attendance/${id}`)} />
    </Page>
  );
}

function ByType({ services }: { services: Service[] }) {
  const rows = useMemo(() => {
    const map = new Map<string, number[]>();
    services.forEach((s) => map.set(s.type, [...(map.get(s.type) ?? []), serviceTotal(s)]));
    return [...map.entries()].map(([type, v]) => ({ label: type, value: Math.round(sum(v, (x) => x) / v.length), count: v.length })).sort((a, b) => b.value - a.value);
  }, [services]);
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card>
      <CardHeader title="Average by service" description="Mean attendance per service type" />
      <ul className="space-y-3 px-5 pb-5">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate text-fg-2">{r.label}</span><span className="font-medium tabular">{num(r.value)} <span className="text-xs font-normal text-fg-3">· {r.count} services</span></span></div>
            <div className="h-2 rounded-full bg-surface-2"><div className="h-full rounded-full bg-[var(--color-series-1)]" style={{ width: `${(r.value / max) * 100}%` }} /></div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Active members with no check-in in the last N Sundays (needs check-ins to be recorded). */
function Absentees({ services }: { services: Service[] }) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { data: members } = useMembers();
  const { data: followups } = useFollowUps();
  const [weeks, setWeeks] = useState(3);
  const [seen, setSeen] = useState<Set<string> | null>(null);

  const recentSundays = useMemo(() => [...new Set(services.filter((s) => new Date(s.date).getDay() === 0).map((s) => s.date))].slice(0, weeks), [services, weeks]);
  useEffect(() => {
    if (!recentSundays.length) return setSeen(new Set());
    setSeen(null);
    const since = recentSundays[recentSundays.length - 1];
    getDocs(query(collection(db, 'attendance'), where('date', '>=', since)))
      .then((snap) => setSeen(new Set(snap.docs.map((d) => d.data().memberId as string))))
      .catch(() => setSeen(new Set()));
  }, [recentSundays]);

  const absent: Member[] = useMemo(
    () => (seen ? members.filter((m) => ['member', 'worker', 'leader', 'new_convert'].includes(m.membershipStatus) && !seen.has(m.id) && ACTIVE_STATUSES.includes(m.membershipStatus)) : []),
    [members, seen],
  );
  const open = new Set(followups.filter((f) => f.kind === 'absentee' && f.stage !== 'closed' && f.stage !== 'integrated').map((f) => f.memberId));

  async function createFollowUps() {
    const todo = absent.filter((m) => !open.has(m.id));
    for (const m of todo) await createDoc('followups', { memberId: m.id, name: m.fullName, phone: m.phone, kind: 'absentee', stage: 'new', assignedTo: null, assignedName: '', dueDate: isoDate(new Date(Date.now() + 3 * 864e5)), notes: [] });
    toast.success(`${todo.length} follow-ups created`, { action: { label: 'Open', onClick: () => navigate('/admin/follow-ups') } });
  }
  function sms() {
    sessionStorage.setItem(SMS_SELECTION_KEY, JSON.stringify(absent.map((m) => m.id)));
    navigate('/admin/messages?compose=1&audience=selection&label=Absentees&template=absentee');
  }

  return (
    <Card>
      <CardHeader
        title="Missing members"
        description={`Active members with no check-in in the last ${weeks} Sundays`}
        icon={<UserX />}
        action={
          <Select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="h-8 w-28 text-xs" aria-label="Weeks">
            {[2, 3, 4, 6, 8].map((w) => <option key={w} value={w}>{w} Sundays</option>)}
          </Select>
        }
      />
      {seen === null ? (
        <SkeletonRows rows={4} />
      ) : absent.length === 0 ? (
        <EmptyState compact title="No one is missing" description="Either everyone has been in church, or check-ins aren’t being recorded yet." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 border-y border-line bg-surface-2/50 px-5 py-2.5">
            <span className="mr-auto self-center text-sm font-medium">{absent.length} people</span>
            {can('followups.manage') && <Button size="xs" variant="outline" icon={<Route />} onClick={createFollowUps}>Create follow-ups</Button>}
            {can('messaging.sms') && <Button size="xs" icon={<Send />} onClick={sms}>SMS them</Button>}
          </div>
          <ul className="max-h-[480px] divide-y divide-line overflow-y-auto">
            {absent.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-5 py-2.5">
                <Avatar name={m.fullName} src={m.photoUrl} size="sm" />
                <button className="min-w-0 flex-1 text-left" onClick={() => navigate(`/admin/people/${m.id}`)}>
                  <span className="block truncate text-sm font-medium">{m.fullName}</span>
                  <span className="block text-xs text-fg-3">{formatPhone(m.phone) || '—'}</span>
                </button>
                {open.has(m.id) && <Badge tone="warning">Following up</Badge>}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
