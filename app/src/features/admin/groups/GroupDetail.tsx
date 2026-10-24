import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Pencil, UserPlus, Send, Trash2, Crown, MoreHorizontal, UserMinus, Download, UsersRound } from 'lucide-react';
import { arrayRemove, arrayUnion } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useGroup, useMembers } from '@/lib/queries';
import { patchDoc, removeDoc } from '@/lib/db';
import { formatPhone } from '@/lib/phone';
import { downloadCsv } from '@/lib/files';
import { fmtTime } from '@/lib/format';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState, FullPageLoader } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/dialog';
import { SearchInput } from '@/components/ui/input';
import { MemberPicker, matchMember } from '@/components/member-picker';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { useConfirm } from '@/components/ui/confirm';
import { GroupForm, GROUP_TYPES } from './GroupForm';
import { STATUS_META } from '../people/shared';
import { SMS_SELECTION_KEY } from '../people/People';

export default function GroupDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { data: g, loading } = useGroup(id);
  const { data: members } = useMembers();
  const [edit, setEdit] = useState(false);
  const [add, setAdd] = useState(false);
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<{ id: string | null; name: string } | null>(null);

  const people = useMemo(() => members.filter((m) => m.groupIds?.includes(id ?? '')), [members, id]);
  const filtered = people.filter((m) => matchMember(m, q));
  const manage = can('groups.manage');

  if (loading) return <FullPageLoader />;
  if (!g) return <Page><EmptyState icon={<UsersRound />} title="Group not found" /></Page>;

  async function addMember() {
    if (!pick?.id) return;
    await patchDoc('members', pick.id, { groupIds: arrayUnion(g!.id) });
    toast.success(`${pick.name} added to ${g!.name}`);
    setPick(null);
  }
  async function removeMember(mid: string, name: string) {
    await patchDoc('members', mid, { groupIds: arrayRemove(g!.id) });
    if (g!.leaderIds?.includes(mid)) await toggleLeader(mid, name);
    toast.success(`${name} removed`);
  }
  async function toggleLeader(mid: string, name: string) {
    const isLeader = g!.leaderIds?.includes(mid);
    const leaderIds = isLeader ? g!.leaderIds.filter((x) => x !== mid) : [...(g!.leaderIds ?? []), mid];
    const leaderNames = members.filter((m) => leaderIds.includes(m.id)).map((m) => m.fullName);
    await patchDoc('groups', g!.id, { leaderIds, leaderNames });
    toast.success(isLeader ? `${name} is no longer a leader` : `${name} is now a leader`);
  }
  async function del() {
    if (!(await confirm({ title: `Delete ${g!.name}?`, description: 'People stay in the directory; only the group is removed.', danger: true, confirmLabel: 'Delete group' }))) return;
    await removeDoc('groups', g!.id, { audit: `Deleted group ${g!.name}` });
    navigate('/admin/groups', { replace: true });
  }
  function sms() {
    sessionStorage.setItem(SMS_SELECTION_KEY, JSON.stringify(people.map((m) => m.id)));
    navigate(`/admin/messages?compose=1&audience=selection&label=${encodeURIComponent(g!.name)}`);
  }

  return (
    <Page>
      <PageHeader
        back={{ to: '/admin/groups', label: 'Groups' }}
        eyebrow={GROUP_TYPES.find((t) => t.value === g.type)?.label}
        title={g.name}
        description={[g.meetingDay, g.meetingTime && fmtTime(`2000-01-01T${g.meetingTime}`), g.location].filter(Boolean).join(' · ') || g.description}
        actions={
          <>
            {can('messaging.sms') && people.length > 0 && <Button size="sm" variant="outline" icon={<Send />} onClick={sms}>SMS group</Button>}
            {manage && <Button size="sm" icon={<UserPlus />} onClick={() => setAdd(true)}>Add people</Button>}
            <Menu>
              <MenuTrigger asChild>
                <Button size="icon-sm" variant="outline" aria-label="More" icon={<MoreHorizontal />} />
              </MenuTrigger>
              <MenuContent>
                <MenuItem icon={<Download />} onSelect={() => downloadCsv(`${g.name}.csv`, people.map((m) => ({ Name: m.fullName, Phone: formatPhone(m.phone), Email: m.email ?? '', Leader: g.leaderIds?.includes(m.id) ? 'Yes' : '' })))}>Export list</MenuItem>
                {manage && <MenuItem icon={<Pencil />} onSelect={() => setEdit(true)}>Edit group</MenuItem>}
                {manage && <MenuItem icon={<Trash2 />} danger onSelect={del}>Delete group</MenuItem>}
              </MenuContent>
            </Menu>
          </>
        }
      />
      {g.description && <p className="-mt-3 mb-5 max-w-2xl text-sm text-fg-2">{g.description}</p>}
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">{people.length} {people.length === 1 ? 'person' : 'people'}</h2>
        {people.length > 8 && <SearchInput value={q} onChange={setQ} className="w-56" placeholder="Filter" />}
      </div>
      <Card>
        {people.length === 0 ? (
          <EmptyState icon={<UsersRound />} title="No one in this group yet" action={manage && <Button icon={<UserPlus />} onClick={() => setAdd(true)}>Add people</Button>} />
        ) : (
          <ul className="divide-y divide-line">
            {filtered
              .sort((a, b) => Number(g.leaderIds?.includes(b.id)) - Number(g.leaderIds?.includes(a.id)) || a.fullName.localeCompare(b.fullName))
              .map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <Avatar name={m.fullName} src={m.photoUrl} size="sm" />
                  <Link to={`/admin/people/${m.id}`} className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium hover:underline">{m.fullName}</span>
                      {g.leaderIds?.includes(m.id) && <Badge tone="gold"><Crown className="size-3" />Leader</Badge>}
                    </span>
                    <span className="block truncate text-xs text-fg-3">{formatPhone(m.phone) || '—'} · {STATUS_META[m.membershipStatus]?.label}</span>
                  </Link>
                  {manage && (
                    <Menu>
                      <MenuTrigger asChild>
                        <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${m.fullName}`} icon={<MoreHorizontal />} />
                      </MenuTrigger>
                      <MenuContent>
                        <MenuItem icon={<Crown />} onSelect={() => toggleLeader(m.id, m.fullName)}>{g.leaderIds?.includes(m.id) ? 'Remove as leader' : 'Make leader'}</MenuItem>
                        <MenuItem icon={<UserMinus />} danger onSelect={() => removeMember(m.id, m.fullName)}>Remove from group</MenuItem>
                      </MenuContent>
                    </Menu>
                  )}
                </li>
              ))}
          </ul>
        )}
      </Card>
      <Modal open={add} onOpenChange={setAdd} title={`Add to ${g.name}`} description="Search and add one person at a time." size="sm" footer={<Button onClick={() => setAdd(false)} variant="outline">Done</Button>}>
        <div className="flex min-h-72 items-start gap-2">
          <div className="flex-1">
            <MemberPicker value={pick} onChange={setPick} exclude={new Set(people.map((p) => p.id))} autoFocus />
          </div>
          <Button onClick={addMember} disabled={!pick?.id}>Add</Button>
        </div>
      </Modal>
      <GroupForm open={edit} onOpenChange={setEdit} group={g} />
    </Page>
  );
}
