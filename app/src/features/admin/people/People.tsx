import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Download, Upload, UserPlus, Users, Send, Tag, X, FolderPlus } from 'lucide-react';
import { arrayUnion, doc, writeBatch } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useGroups, useMembers } from '@/lib/queries';
import { formatPhone } from '@/lib/phone';
import { age, fmtDate } from '@/lib/format';
import { downloadCsv } from '@/lib/files';
import { audit, db } from '@/lib/db';
import { useLocalState } from '@/lib/hooks';
import type { Member, MembershipStatus } from '@/lib/types';
import { Page, PageHeader, Toolbar } from '@/components/ui/page';
import { Button, ButtonLink } from '@/components/ui/button';
import { SearchInput, Select } from '@/components/ui/input';
import { Segmented } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/ui/table';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState, SkeletonRows } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/dialog';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { matchMember } from '@/components/member-picker';
import { PersonForm, STATUS_META } from './shared';

type Filter = 'all' | 'members' | 'workers' | 'new' | 'inactive';
const FILTERS: Record<Filter, (m: Member) => boolean> = {
  all: (m) => !['deceased', 'transferred'].includes(m.membershipStatus),
  members: (m) => ['member', 'worker', 'leader', 'new_convert'].includes(m.membershipStatus),
  workers: (m) => ['worker', 'leader'].includes(m.membershipStatus),
  new: (m) => ['first_timer', 'visitor', 'new_convert'].includes(m.membershipStatus),
  inactive: (m) => ['inactive', 'transferred', 'deceased'].includes(m.membershipStatus),
};

/** Hand-off of selected people to the SMS composer. */
export const SMS_SELECTION_KEY = 'cwc-sms-selection';

export default function People() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: members, loading } = useMembers();
  const { data: groups } = useGroups();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useLocalState<Filter>('cwc-people-filter', 'all');
  const [groupId, setGroupId] = useState('');
  const [gender, setGender] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [bulk, setBulk] = useState<null | 'group' | 'status'>(null);

  useEffect(() => {
    if (params.get('new') === '1') {
      setFormOpen(true);
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const groupName = useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups]);

  const rows = useMemo(
    () =>
      members.filter(
        (m) => FILTERS[filter](m) && (!groupId || m.groupIds?.includes(groupId)) && (!gender || m.gender === gender) && matchMember(m, q),
      ),
    [members, filter, groupId, gender, q],
  );

  const counts = useMemo(() => {
    const c = {} as Record<Filter, number>;
    (Object.keys(FILTERS) as Filter[]).forEach((f) => (c[f] = members.filter(FILTERS[f]).length));
    return c;
  }, [members]);

  const columns: Column<Member>[] = [
    {
      key: 'name',
      header: 'Name',
      sort: (m) => m.fullName,
      cell: (m) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={m.fullName} src={m.photoUrl} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-medium">{m.fullName}</div>
            {m.email && <div className="truncate text-xs text-fg-3">{m.email}</div>}
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', cell: (m) => <span className="whitespace-nowrap tabular text-fg-2">{formatPhone(m.phone) || '—'}</span> },
    {
      key: 'status',
      header: 'Status',
      sort: (m) => m.membershipStatus,
      cell: (m) => <Badge tone={STATUS_META[m.membershipStatus]?.tone}>{STATUS_META[m.membershipStatus]?.label ?? m.membershipStatus}</Badge>,
    },
    {
      key: 'groups',
      header: 'Groups',
      hideBelow: 'lg',
      cell: (m) => (
        <div className="flex max-w-64 flex-wrap gap-1">
          {(m.groupIds ?? []).slice(0, 2).map((g) => (
            <span key={g} className="truncate rounded-md bg-surface-2 px-1.5 py-0.5 text-xs text-fg-2">
              {groupName.get(g) ?? '—'}
            </span>
          ))}
          {(m.groupIds?.length ?? 0) > 2 && <span className="text-xs text-fg-3">+{m.groupIds.length - 2}</span>}
        </div>
      ),
    },
    { key: 'age', header: 'Age', hideBelow: 'xl', align: 'right', sort: (m) => age(m.dob) ?? -1, cell: (m) => age(m.dob) ?? '—' },
    { key: 'joined', header: 'Joined', hideBelow: 'md', sort: (m) => m.joinDate ?? '', cell: (m) => <span className="whitespace-nowrap text-fg-2">{fmtDate(m.joinDate)}</span> },
  ];

  function exportRows(list: Member[]) {
    downloadCsv(
      `cwc-people-${fmtDate(new Date(), 'yyyy-MM-dd')}.csv`,
      list.map((m) => ({
        'First name': m.firstName,
        'Last name': m.lastName,
        'Other names': m.otherNames ?? '',
        Gender: m.gender,
        'Date of birth': m.dob ?? '',
        Phone: formatPhone(m.phone),
        Email: m.email ?? '',
        Status: STATUS_META[m.membershipStatus]?.label,
        Groups: (m.groupIds ?? []).map((g) => groupName.get(g)).filter(Boolean).join('; '),
        Address: m.address ?? '',
        'GPS address': m.gpsAddress ?? '',
        Occupation: m.occupation ?? '',
        'Marital status': m.maritalStatus ?? '',
        Joined: m.joinDate ?? '',
      })),
    );
    void audit('export', 'members', undefined, `Exported ${list.length} people`);
  }

  const selectedList = members.filter((m) => selected.has(m.id));

  function smsSelected() {
    sessionStorage.setItem(SMS_SELECTION_KEY, JSON.stringify(selectedList.map((m) => m.id)));
    navigate('/admin/messages?compose=1&audience=selection');
  }

  return (
    <Page>
      <PageHeader
        title="People"
        description={loading ? 'Loading directory…' : `${counts.all.toLocaleString()} people in the directory`}
        actions={
          <>
            {can('people.manage') && (
              <ButtonLink to="/admin/people/import" variant="outline" size="sm" icon={<Upload />} className="hidden sm:inline-flex">
                Import
              </ButtonLink>
            )}
            <Button variant="outline" size="sm" icon={<Download />} onClick={() => exportRows(rows)} disabled={!rows.length}>
              Export
            </Button>
            {can('people.manage') && (
              <Button size="sm" icon={<UserPlus />} onClick={() => setFormOpen(true)}>
                Add person
              </Button>
            )}
          </>
        }
      />

      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search name, phone, email or tag" className="sm:w-80" />
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `All` },
            { value: 'members', label: 'Members' },
            { value: 'workers', label: 'Workers' },
            { value: 'new', label: 'New' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
        <div className="flex gap-2">
          <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label="Filter by group" className="sm:w-48">
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
          <Select value={gender} onChange={(e) => setGender(e.target.value)} aria-label="Filter by gender" className="w-32">
            <option value="">Anyone</option>
            <option value="female">Women</option>
            <option value="male">Men</option>
          </Select>
        </div>
      </Toolbar>

      {selected.size > 0 && (
        <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-accent-soft px-3 py-2 text-sm dark:border-brand-500/25">
          <span className="font-medium text-accent-soft-fg">{selected.size} selected</span>
          <div className="flex-1" />
          {can('messaging.sms') && (
            <Button size="xs" icon={<Send />} onClick={smsSelected}>
              SMS
            </Button>
          )}
          {can('people.manage') && (
            <Menu>
              <MenuTrigger asChild>
                <Button size="xs" variant="outline" icon={<Tag />}>
                  Update
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem icon={<FolderPlus />} onSelect={() => setBulk('group')}>
                  Add to a group
                </MenuItem>
                <MenuItem icon={<Tag />} onSelect={() => setBulk('status')}>
                  Change status
                </MenuItem>
              </MenuContent>
            </Menu>
          )}
          <Button size="xs" variant="outline" icon={<Download />} onClick={() => exportRows(selectedList)}>
            Export
          </Button>
          <Button size="xs" variant="ghost" icon={<X />} onClick={() => setSelected(new Set())} aria-label="Clear selection" />
        </div>
      )}

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(m) => m.id}
        onRowClick={(m) => navigate(`/admin/people/${m.id}`)}
        isLoading={loading}
        loading={<SkeletonRows rows={8} />}
        defaultSort={{ key: 'name', dir: 'asc' }}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        mobile={(m) => (
          <div className="flex items-center gap-3">
            <Avatar name={m.fullName} src={m.photoUrl} size="md" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{m.fullName}</div>
              <div className="truncate text-[13px] text-fg-3">{formatPhone(m.phone) || m.email || '—'}</div>
            </div>
            <Badge tone={STATUS_META[m.membershipStatus]?.tone}>{STATUS_META[m.membershipStatus]?.label}</Badge>
          </div>
        )}
        empty={
          members.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title="Your directory is empty"
              description="Add people one at a time or import your existing list from a spreadsheet."
              action={
                can('people.manage') && (
                  <>
                    <Button icon={<UserPlus />} onClick={() => setFormOpen(true)}>
                      Add person
                    </Button>
                    <ButtonLink to="/admin/people/import" variant="outline" icon={<Upload />}>
                      Import CSV
                    </ButtonLink>
                  </>
                )
              }
            />
          ) : (
            <EmptyState icon={<Users />} title="No matches" description="Try a different name or clear the filters." />
          )
        }
      />

      <PersonForm open={formOpen} onOpenChange={setFormOpen} onSaved={(id) => navigate(`/admin/people/${id}`)} />
      <BulkUpdate mode={bulk} onClose={() => setBulk(null)} ids={[...selected]} groups={groups} onDone={() => setSelected(new Set())} />
    </Page>
  );
}

function BulkUpdate({
  mode,
  onClose,
  ids,
  groups,
  onDone,
}: {
  mode: null | 'group' | 'status';
  onClose: () => void;
  ids: string[];
  groups: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setValue('');
  }, [mode]);
  async function apply() {
    if (!value) return;
    setBusy(true);
    try {
      for (let i = 0; i < ids.length; i += 400) {
        const b = writeBatch(db);
        ids.slice(i, i + 400).forEach((id) =>
          b.update(doc(db, 'members', id), mode === 'group' ? { groupIds: arrayUnion(value) } : { membershipStatus: value as MembershipStatus }),
        );
        await b.commit();
      }
      void audit('update', 'members', undefined, `Bulk ${mode === 'group' ? 'added to group' : 'status change'} for ${ids.length} people`);
      toast.success(`Updated ${ids.length} ${ids.length === 1 ? 'person' : 'people'}`);
      onDone();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={!!mode}
      onOpenChange={(o) => !o && onClose()}
      title={mode === 'group' ? 'Add to a group' : 'Change membership status'}
      description={`${ids.length} selected`}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={apply} loading={busy} disabled={!value}>
            Apply
          </Button>
        </>
      }
    >
      <Select value={value} onChange={(e) => setValue(e.target.value)} aria-label={mode === 'group' ? 'Group' : 'Status'}>
        <option value="">Choose…</option>
        {mode === 'group'
          ? groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))
          : Object.entries(STATUS_META).map(([v, m]) => (
              <option key={v} value={v}>
                {m.label}
              </option>
            ))}
      </Select>
    </Modal>
  );
}
