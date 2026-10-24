import { useMemo } from 'react';
import { format, subDays, startOfMonth, subMonths } from 'date-fns';
import { Users, CalendarCheck2, HandCoins, HeartHandshake, UserPlus, Send, Cake, Route, CalendarDays, ChevronRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { useAuth } from '@/lib/auth';
import { useCareRequests, useEvents, useExpensesSince, useFollowUps, useGiftsSince, useMembers, useServices } from '@/lib/queries';
import { attendanceByDate, change, monthlyFinance, upcomingBirthdays, ACTIVE_STATUSES } from '@/lib/stats';
import { cedis, friendlyDay, greeting, isoDate, num, relative } from '@/lib/format';
import { sum } from '@/lib/utils';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardHeader, CardLink, Stat } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/feedback';
import { ChartCard, BarList } from '@/components/charts';
import { useChurch } from '@/lib/settings';

export default function Dashboard() {
  const { profile, can } = useAuth();
  const church = useChurch();
  const canGiving = can('giving.view');
  const canCare = can('care.view');
  const sixMonths = isoDate(startOfMonth(subMonths(new Date(), 5)));

  const members = useMembers();
  const services = useServices(can('attendance.manage') || can('reports.view') || can('people.view'), 60);
  const gifts = useGiftsSince(sixMonths, canGiving);
  const expenses = useExpensesSince(sixMonths, canGiving);
  const followups = useFollowUps(can('followups.manage'));
  const care = useCareRequests(canCare);
  const events = useEvents(can('events.manage'));

  const firstName = (profile?.fullName || '').replace(/^(Rev\.|Pastor|Dr\.|Mr\.|Mrs\.|Ps\.)\s+/i, '').split(' ')[0];

  const m = useMemo(() => {
    const active = members.data.filter((x) => ACTIVE_STATUSES.includes(x.membershipStatus));
    const monthStart = isoDate(startOfMonth(new Date()));
    const newThisMonth = members.data.filter((x) => (x.joinDate ?? '') >= monthStart).length;
    const ft30 = members.data.filter((x) => x.membershipStatus === 'first_timer' && (x.joinDate ?? '') >= isoDate(subDays(new Date(), 30))).length;
    return { active: active.length, total: members.data.length, newThisMonth, ft30 };
  }, [members.data]);

  const attendance = useMemo(() => attendanceByDate(services.data, 10), [services.data]);
  const avg = (arr: { total: number }[]) => (arr.length ? Math.round(sum(arr, (a) => a.total) / arr.length) : 0);
  const last4 = attendance.slice(-4);
  const prev4 = attendance.slice(-8, -4);

  const finance = useMemo(() => monthlyFinance(gifts.data, expenses.data, 6), [gifts.data, expenses.data]);
  const thisMonth = finance[finance.length - 1];
  const lastMonth = finance[finance.length - 2];

  const givingByCategory = useMemo(() => {
    const k = format(new Date(), 'yyyy-MM');
    const map = new Map<string, number>();
    gifts.data.filter((g) => g.date.startsWith(k)).forEach((g) => map.set(g.category, (map.get(g.category) ?? 0) + g.amount));
    return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [gifts.data]);

  const birthdays = useMemo(() => upcomingBirthdays(members.data, 7), [members.data]);
  const openCare = care.data.filter((c) => c.status === 'new' || c.status === 'in_progress');
  const dueFollowUps = followups.data.filter((f) => !['integrated', 'closed'].includes(f.stage));
  const upcoming = events.data.filter((e) => e.startAt >= isoDate()).sort((a, b) => a.startAt.localeCompare(b.startAt)).slice(0, 4);

  const actions = [
    can('people.manage') && { to: '/admin/people?new=1', label: 'Add person', icon: <UserPlus /> },
    can('attendance.manage') && { to: '/admin/attendance?new=1', label: 'Take attendance', icon: <CalendarCheck2 /> },
    can('giving.manage') && { to: '/admin/giving?new=1', label: 'Record giving', icon: <HandCoins /> },
    can('messaging.sms') && { to: '/admin/messages?compose=1', label: 'Send SMS', icon: <Send /> },
  ].filter(Boolean) as { to: string; label: string; icon: React.ReactNode }[];

  return (
    <Page>
      <PageHeader
        eyebrow={format(new Date(), 'EEEE, d MMMM yyyy')}
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        description={`Here’s what’s happening at ${church.shortName} today.`}
        docTitle="Dashboard"
        actions={actions.map((a, i) => (
          <ButtonLink key={a.to} to={a.to} variant={i === 0 ? 'primary' : 'outline'} size="sm" icon={a.icon} className={i > 1 ? 'hidden sm:inline-flex' : ''}>
            {a.label}
          </ButtonLink>
        ))}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Active members" value={num(m.active)} hint={`${num(m.newThisMonth)} joined this month`} icon={<Users />} to="/admin/people" loading={members.loading} />
        <Stat
          label="Avg Sunday attendance"
          value={num(avg(last4))}
          trend={change(avg(last4), avg(prev4))}
          hint="last 4 weeks"
          icon={<CalendarCheck2 />}
          tone="info"
          to={can('attendance.manage') ? '/admin/attendance' : undefined}
          loading={services.loading}
        />
        {canGiving ? (
          <Stat
            label={`Giving in ${format(new Date(), 'MMMM')}`}
            value={cedis(thisMonth?.income, { compact: true })}
            trend={change(thisMonth?.income ?? 0, lastMonth?.income ?? 0)}
            hint="vs last month"
            icon={<HandCoins />}
            tone="gold"
            to="/admin/giving"
            loading={gifts.loading}
          />
        ) : (
          <Stat label="First-timers (30 days)" value={num(m.ft30)} hint="welcome them well" icon={<Sparkles />} tone="gold" loading={members.loading} />
        )}
        {canCare ? (
          <Stat label="Open care requests" value={num(openCare.length)} hint={`${care.data.filter((c) => c.status === 'new').length} new`} icon={<HeartHandshake />} tone="danger" to="/admin/care" loading={care.loading} />
        ) : (
          <Stat label="Open follow-ups" value={num(dueFollowUps.length)} hint="first-timers & absentees" icon={<Route />} tone="success" to="/admin/follow-ups" loading={followups.loading} />
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Sunday attendance"
          description="Total across all Sunday services"
          data={attendance}
          xKey="label"
          xLabel="Sunday"
          series={[{ key: 'total', label: 'Attendance' }]}
          kind="area"
          action={<CardLink to="/admin/attendance">Details</CardLink>}
          empty="Record a service to start tracking attendance."
        />
        <Card>
          <CardHeader title="Birthdays this week" icon={<Cake />} action={can('messaging.sms') && birthdays.length > 0 ? <CardLink to="/admin/messages?compose=1&audience=birthdays">Send wishes</CardLink> : undefined} />
          {birthdays.length === 0 ? (
            <EmptyState compact title="No birthdays this week" description="We’ll list them here as they come up." />
          ) : (
            <ul className="max-h-[280px] divide-y divide-line overflow-y-auto pb-2">
              {birthdays.slice(0, 12).map(({ member, date, inDays, turning }) => (
                <li key={member.id}>
                  <Link to={`/admin/people/${member.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2">
                    <Avatar name={member.fullName} src={member.photoUrl} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{member.fullName}</span>
                      <span className="block text-xs text-fg-3">
                        {format(date, 'EEE d MMM')}
                        {turning ? ` · turns ${turning}` : ''}
                      </span>
                    </span>
                    {inDays === 0 ? <Badge tone="gold">Today</Badge> : <span className="text-xs text-fg-3">in {inDays}d</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {canGiving && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <ChartCard
            className="lg:col-span-2"
            title="Income & expenses"
            description="Last 6 months"
            data={finance}
            xKey="label"
            xLabel="Month"
            kind="bar"
            series={[
              { key: 'income', label: 'Income', format: (v) => cedis(v) },
              { key: 'expenses', label: 'Expenses', format: (v) => cedis(v) },
            ]}
            action={<CardLink to="/admin/giving">Finance</CardLink>}
          />
          <Card>
            <CardHeader title="Giving by category" description={format(new Date(), 'MMMM yyyy')} />
            <BarList items={givingByCategory} format={(v) => cedis(v, { compact: true })} empty="No giving recorded this month yet." />
          </Card>
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {can('followups.manage') && (
          <Card>
            <CardHeader title="Follow-ups" description="First-timers & absentees" icon={<Route />} action={<CardLink to="/admin/follow-ups" />} />
            {dueFollowUps.length === 0 ? (
              <EmptyState compact title="All caught up" description="New first-timers will appear here." />
            ) : (
              <ul className="divide-y divide-line pb-2">
                {dueFollowUps.slice(0, 5).map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-5 py-2.5">
                    <Avatar name={f.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{f.name}</span>
                      <span className="block text-xs text-fg-3">{f.kind === 'absentee' ? 'Absentee' : f.kind === 'first_timer' ? 'First-timer' : 'Follow-up'} · {relative(f.createdAt)}</span>
                    </span>
                    <Badge tone={f.stage === 'new' ? 'brand' : 'neutral'}>{f.stage}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        {canCare && (
          <Card>
            <CardHeader title="Care requests" description="Prayer, counselling & visits" icon={<HeartHandshake />} action={<CardLink to="/admin/care" />} />
            {openCare.length === 0 ? (
              <EmptyState compact title="No open requests" />
            ) : (
              <ul className="divide-y divide-line pb-2">
                {openCare.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <Link to={`/admin/care?open=${c.id}`} className="flex items-start gap-3 px-5 py-2.5 hover:bg-surface-2">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${c.type === 'urgent' ? 'bg-danger' : c.status === 'new' ? 'bg-brand-500' : 'bg-line-strong'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c.subject || c.details}</span>
                        <span className="block text-xs text-fg-3">
                          <span className="capitalize">{c.type}</span> · {c.anonymous ? 'Anonymous' : c.name} · {relative(c.createdAt)}
                        </span>
                      </span>
                      <ChevronRight className="mt-1 size-4 text-fg-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        {can('events.manage') && (
          <Card>
            <CardHeader title="Upcoming events" icon={<CalendarDays />} action={<CardLink to="/admin/events" />} />
            {upcoming.length === 0 ? (
              <EmptyState compact title="Nothing scheduled" action={<ButtonLink to="/admin/events?new=1" size="sm" variant="outline">Create event</ButtonLink>} />
            ) : (
              <ul className="divide-y divide-line pb-2">
                {upcoming.map((e) => (
                  <li key={e.id}>
                    <Link to={`/admin/events/${e.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2">
                      <span className="grid w-11 shrink-0 place-items-center rounded-lg border border-line py-1 text-center leading-none">
                        <span className="text-[10px] font-semibold uppercase text-danger">{format(new Date(e.startAt), 'MMM')}</span>
                        <span className="text-base font-semibold">{format(new Date(e.startAt), 'd')}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{e.title}</span>
                        <span className="block text-xs text-fg-3">
                          {friendlyDay(e.startAt)} · {num(e.rsvpCount ?? 0)} RSVPs
                        </span>
                      </span>
                      {e.status === 'draft' && <Badge>Draft</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </Page>
  );
}
