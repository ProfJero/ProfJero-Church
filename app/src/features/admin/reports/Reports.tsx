import { useMemo, useState } from 'react';
import { format, parseISO, startOfYear, subYears } from 'date-fns';
import { Download, Printer, Users, CalendarCheck2, HandCoins, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useExpensesSince, useGiftsSince, useGroups, useMembers, useServices } from '@/lib/queries';
import { attendanceByDate, monthKeys, serviceTotal, ACTIVE_STATUSES } from '@/lib/stats';
import { age, cedis, isoDate, num, pct } from '@/lib/format';
import { downloadCsv } from '@/lib/files';
import { printDocument, escapeHtml } from '@/lib/print';
import { groupBy, sum } from '@/lib/utils';
import { useChurch } from '@/lib/settings';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardHeader, Stat } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { ChartCard, BarList } from '@/components/charts';
import { STATUS_META } from '../people/shared';

const AGE_BANDS: [string, number, number][] = [['Children (0–12)', 0, 12], ['Teens (13–17)', 13, 17], ['Young adults (18–35)', 18, 35], ['Adults (36–59)', 36, 59], ['Seniors (60+)', 60, 200]];

export default function Reports() {
  const { can } = useAuth();
  const church = useChurch();
  const [year, setYear] = useState(new Date().getFullYear());
  const from = isoDate(startOfYear(new Date(year, 0, 1)));
  const to = `${year}-12-31`;
  const { data: members, loading } = useMembers();
  const { data: groups } = useGroups();
  const { data: services } = useServices(true, 400);
  const giftsQ = useGiftsSince(from, can('giving.view'));
  const expQ = useExpensesSince(from, can('giving.view'));
  const gifts = giftsQ.data.filter((g) => g.date <= to);
  const expenses = expQ.data.filter((e) => e.date <= to);

  const active = members.filter((m) => ACTIVE_STATUSES.includes(m.membershipStatus));
  const joinedThisYear = members.filter((m) => (m.joinDate ?? '').startsWith(String(year)));
  const yearServices = services.filter((s) => s.date.startsWith(String(year)));

  const growth = useMemo(() => {
    const keys = year === new Date().getFullYear() ? monthKeys(new Date().getMonth() + 1) : Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    return keys.map((k) => ({ label: format(parseISO(k + '-01'), 'MMM'), joined: members.filter((m) => (m.joinDate ?? '').startsWith(k)).length, firstTimers: members.filter((m) => (m.joinDate ?? '').startsWith(k) && ['first_timer', 'visitor'].includes(m.membershipStatus)).length }));
  }, [members, year]);

  const statusRows = Object.entries(STATUS_META).map(([k, v]) => ({ label: v.label, value: members.filter((m) => m.membershipStatus === k).length })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const genderRows = [{ label: 'Women', value: active.filter((m) => m.gender === 'female').length }, { label: 'Men', value: active.filter((m) => m.gender === 'male').length }, { label: 'Not recorded', value: active.filter((m) => !m.gender).length }].filter((r) => r.value);
  const ageRows = AGE_BANDS.map(([label, lo, hi]) => ({ label, value: active.filter((m) => { const a = age(m.dob); return a !== null && a >= lo && a <= hi; }).length }));
  const groupRows = groups.map((g) => ({ label: g.name, value: members.filter((m) => m.groupIds?.includes(g.id)).length })).sort((a, b) => b.value - a.value).slice(0, 10);
  const unGrouped = active.filter((m) => !m.groupIds?.length).length;

  const attendance = attendanceByDate(yearServices, 60);
  const avgSunday = attendance.length ? Math.round(sum(attendance, (a) => a.total) / attendance.length) : 0;

  const finance = useMemo(() => {
    const keys = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`).filter((k) => k <= format(new Date(), 'yyyy-MM'));
    return keys.map((k) => ({ label: format(parseISO(k + '-01'), 'MMM'), income: sum(gifts.filter((g) => g.date.startsWith(k)), (g) => g.amount), expenses: sum(expenses.filter((e) => e.date.startsWith(k)), (e) => e.amount), tithers: new Set(gifts.filter((g) => g.date.startsWith(k) && g.category === 'Tithe' && g.memberId).map((g) => g.memberId)).size }));
  }, [gifts, expenses, year]);
  const income = sum(gifts, (g) => g.amount);
  const catRows = [...groupBy(gifts, (g) => g.category).entries()].map(([label, v]) => ({ label, value: sum(v, (g) => g.amount) })).sort((a, b) => b.value - a.value);

  function exportAll() {
    downloadCsv(`cwc-report-${year}.csv`, [
      ...statusRows.map((r) => ({ Section: 'Membership status', Item: r.label, Value: r.value })),
      ...ageRows.map((r) => ({ Section: 'Age band (active)', Item: r.label, Value: r.value })),
      ...groupRows.map((r) => ({ Section: 'Group size', Item: r.label, Value: r.value })),
      ...growth.map((r) => ({ Section: 'Joined per month', Item: r.label, Value: r.joined })),
      ...attendance.map((r) => ({ Section: 'Sunday attendance', Item: r.date, Value: r.total })),
      ...(can('giving.view') ? finance.flatMap((r) => [{ Section: 'Income', Item: r.label, Value: r.income }, { Section: 'Expenses', Item: r.label, Value: r.expenses }]) : []),
    ]);
  }

  function printAnnual() {
    const tr = (rows: { label: string; value: number }[], f: (v: number) => string = num) => rows.map((r) => `<tr><td>${escapeHtml(r.label)}</td><td class="num">${escapeHtml(f(r.value))}</td></tr>`).join('');
    printDocument(`${church.name} — ${year} report`, `
      <div class="head"><div><h1>${escapeHtml(church.name)}</h1><div class="muted">Annual report ${year}</div></div></div>
      <h2>Membership</h2><table><tbody>${tr([{ label: 'People in directory', value: members.length }, { label: 'Active members', value: active.length }, { label: `Joined in ${year}`, value: joinedThisYear.length }])}${tr(statusRows)}</tbody></table>
      <h2>Age profile (active)</h2><table><tbody>${tr(ageRows)}</tbody></table>
      <h2>Attendance</h2><table><tbody>${tr([{ label: 'Services recorded', value: yearServices.length }, { label: 'Average Sunday attendance', value: avgSunday }])}</tbody></table>
      ${can('giving.view') ? `<h2>Giving</h2><table><tbody>${tr(catRows, (v) => cedis(v))}</tbody><tfoot><tr class="total"><td>Total income</td><td class="num">${escapeHtml(cedis(income))}</td></tr><tr><td>Total expenses</td><td class="num">${escapeHtml(cedis(sum(expenses, (e) => e.amount)))}</td></tr></tfoot></table>` : ''}
    `);
  }

  const years = [new Date().getFullYear(), subYears(new Date(), 1).getFullYear(), subYears(new Date(), 2).getFullYear()];

  return (
    <Page>
      <PageHeader title="Reports" description="Growth, demographics, attendance and giving at a glance." actions={<><Button size="sm" variant="outline" icon={<Printer />} onClick={printAnnual}>Annual report</Button><Button size="sm" variant="outline" icon={<Download />} onClick={exportAll}>CSV</Button></>} />
      <div className="mb-4 flex items-center gap-2">
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-32" aria-label="Year">{years.map((y) => <option key={y}>{y}</option>)}</Select>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Active members" value={num(active.length)} hint={`${num(members.length)} in directory`} icon={<Users />} loading={loading} />
        <Stat label={`Joined in ${year}`} value={num(joinedThisYear.length)} hint={pct(members.length ? joinedThisYear.length / members.length : 0) + ' of directory'} icon={<UserPlus />} tone="gold" loading={loading} />
        <Stat label="Avg Sunday" value={num(avgSunday)} hint={`${yearServices.length} services`} icon={<CalendarCheck2 />} tone="info" />
        {can('giving.view') ? <Stat label={`Income ${year}`} value={cedis(income, { compact: true })} icon={<HandCoins />} tone="success" /> : <Stat label="Not in a group" value={num(unGrouped)} hint="active members" tone="danger" />}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="New people per month" description="By date joined / first visit" data={growth} xKey="label" xLabel="Month" kind="bar" series={[{ key: 'joined', label: 'Joined' }]} />
        <ChartCard title="Sunday attendance" description={String(year)} data={attendance} xKey="label" xLabel="Sunday" kind="area" series={[{ key: 'total', label: 'Attendance' }]} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card><CardHeader title="Membership status" /><BarList items={statusRows} format={num} /></Card>
        <Card><CardHeader title="Age profile" description="Active members with a date of birth" /><BarList items={ageRows} format={num} /></Card>
        <Card><CardHeader title="Gender" description="Active members" /><BarList items={genderRows} format={(v) => `${num(v)} · ${pct(active.length ? v / active.length : 0)}`} /></Card>
        <Card className="md:col-span-2 xl:col-span-1"><CardHeader title="Largest groups" description={`${num(unGrouped)} active members aren’t in any group`} /><BarList items={groupRows} format={num} /></Card>
        {can('giving.view') && <Card><CardHeader title="Giving by category" description={String(year)} /><BarList items={catRows} format={(v) => cedis(v, { compact: true })} /></Card>}
        <Card><CardHeader title="Services recorded" description={String(year)} /><BarList items={[...groupBy(yearServices, (s) => s.type).entries()].map(([label, v]) => ({ label, value: Math.round(sum(v, serviceTotal) / v.length), hint: `${v.length} services · average shown` }))} format={num} /></Card>
      </div>

      {can('giving.view') && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ChartCard title="Income & expenses" description={String(year)} data={finance} xKey="label" xLabel="Month" kind="bar" series={[{ key: 'income', label: 'Income', format: (v) => cedis(v) }, { key: 'expenses', label: 'Expenses', format: (v) => cedis(v) }]} />
          <ChartCard title="Tithers per month" description="Members who paid tithe" data={finance} xKey="label" xLabel="Month" kind="line" series={[{ key: 'tithers', label: 'Tithers' }]} />
        </div>
      )}
    </Page>
  );
}
