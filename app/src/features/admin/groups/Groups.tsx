import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Plus, UsersRound, Clock, MapPin } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useGroups, useMembers } from '@/lib/queries';
import { Page, PageHeader, Toolbar } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/input';
import { Segmented } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState, SkeletonCards } from '@/components/ui/feedback';
import { GroupForm, GROUP_TYPES } from './GroupForm';
import { fmtTime } from '@/lib/format';

export default function Groups() {
  const { can } = useAuth();
  const { data: groups, loading } = useGroups();
  const { data: members } = useMembers();
  const [type, setType] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const counts = useMemo(() => {
    const c = new Map<string, string[]>();
    members.forEach((m) => (m.groupIds ?? []).forEach((g) => c.set(g, [...(c.get(g) ?? []), m.fullName])));
    return c;
  }, [members]);

  const list = groups.filter((g) => (type === 'all' || g.type === type) && g.name.toLowerCase().includes(q.toLowerCase()));
  const typeLabel = (t: string) => GROUP_TYPES.find((x) => x.value === t)?.label.split(' (')[0] ?? t;

  return (
    <Page>
      <PageHeader
        title="Groups & ministries"
        description="Departments, fellowships, home cells and committees."
        actions={can('groups.manage') && <Button size="sm" icon={<Plus />} onClick={() => setOpen(true)}>New group</Button>}
      />
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search groups" className="sm:w-72" />
        <Segmented
          value={type}
          onChange={setType}
          options={[{ value: 'all', label: 'All' }, ...GROUP_TYPES.slice(0, 5).map((t) => ({ value: t.value, label: t.label.split(' ')[0].replace('Home', 'Cells') }))]}
        />
      </Toolbar>
      {loading ? (
        <SkeletonCards count={6} />
      ) : list.length === 0 ? (
        <div className="card">
          <EmptyState icon={<UsersRound />} title={groups.length ? 'No matching groups' : 'No groups yet'} description="Create ministries, departments and home cells, then add people to them." action={can('groups.manage') && <Button icon={<Plus />} onClick={() => setOpen(true)}>New group</Button>} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((g) => {
            const people = counts.get(g.id) ?? [];
            return (
              <Link key={g.id} to={`/admin/groups/${g.id}`} className="card group flex flex-col p-5 transition-colors hover:border-line-strong">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[15px] font-semibold leading-snug group-hover:underline">{g.name}</h3>
                  <Badge tone={g.type === 'cell' ? 'gold' : g.type === 'fellowship' ? 'info' : 'brand'}>{typeLabel(g.type)}</Badge>
                </div>
                <div className="mt-3 space-y-1.5 text-[13px] text-fg-3">
                  {(g.meetingDay || g.meetingTime) && (
                    <div className="flex items-center gap-2">
                      <Clock className="size-3.5" /> {g.meetingDay}
                      {g.meetingTime && ` · ${fmtTime(`2000-01-01T${g.meetingTime}`)}`}
                    </div>
                  )}
                  {g.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="size-3.5" /> {g.location}
                    </div>
                  )}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 pt-5">
                  <div className="flex -space-x-2">
                    {people.slice(0, 5).map((n, i) => (
                      <Avatar key={i} name={n} size="xs" className="ring-2 ring-surface" />
                    ))}
                  </div>
                  <span className="text-[13px] font-medium text-fg-2">{people.length} {people.length === 1 ? 'person' : 'people'}</span>
                </div>
                {g.leaderNames?.length ? <div className="mt-3 border-t border-line pt-3 text-xs text-fg-3">Led by {g.leaderNames.join(', ')}</div> : null}
              </Link>
            );
          })}
        </div>
      )}
      <GroupForm open={open} onOpenChange={setOpen} />
    </Page>
  );
}
