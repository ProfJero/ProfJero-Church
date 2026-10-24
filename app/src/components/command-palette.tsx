import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Command } from 'cmdk';
import * as D from '@radix-ui/react-dialog';
import { Search, UserPlus, HandCoins, Send, CalendarPlus, CalendarCheck2, CornerDownLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useMembers } from '@/lib/queries';
import { formatPhone } from '@/lib/phone';
import { ADMIN_NAV, visible } from '@/layouts/nav';
import { Avatar } from './ui/avatar';
import { matchMember } from './member-picker';

let openPalette: (() => void) | null = null;
export const showCommandPalette = () => openPalette?.();

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data: members } = useMembers(open && can('people.view'));

  useEffect(() => {
    openPalette = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      openPalette = null;
    };
  }, []);

  const people = useMemo(() => (q.trim().length >= 2 ? members.filter((m) => matchMember(m, q)).slice(0, 7) : []), [members, q]);

  const go = (to: string) => {
    setOpen(false);
    setQ('');
    navigate(to);
  };

  const actions = [
    { label: 'Add a person', icon: UserPlus, to: '/admin/people?new=1', ok: can('people.manage') },
    { label: 'Record giving', icon: HandCoins, to: '/admin/giving?new=1', ok: can('giving.manage') },
    { label: 'Start a service / take attendance', icon: CalendarCheck2, to: '/admin/attendance?new=1', ok: can('attendance.manage') },
    { label: 'Send an SMS', icon: Send, to: '/admin/messages?compose=1', ok: can('messaging.sms') },
    { label: 'Create an event', icon: CalendarPlus, to: '/admin/events?new=1', ok: can('events.manage') },
  ].filter((a) => a.ok);

  const itemCls =
    'flex h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-fg data-[selected=true]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-fg-3';

  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <D.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[max(1rem,12dvh)] z-50 w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)] data-[state=open]:animate-slide-up"
        >
          <D.Title className="sr-only">Search and commands</D.Title>
          <Command shouldFilter={true} loop label="Command palette">
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Search className="size-4 text-fg-3" />
              <Command.Input
                value={q}
                onValueChange={setQ}
                placeholder="Search people, pages and actions…"
                className="h-13 flex-1 bg-transparent py-4 text-[15px] outline-none placeholder:text-fg-3"
              />
              <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 text-[11px] text-fg-3 sm:block">ESC</kbd>
            </div>
            <Command.List className="max-h-[min(60dvh,420px)] overflow-y-auto p-2">
              <Command.Empty className="py-10 text-center text-sm text-fg-3">No results for “{q}”.</Command.Empty>
              {people.length > 0 && (
                <Command.Group heading="People" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-fg-3">
                  {people.map((m) => (
                    <Command.Item key={m.id} value={`person ${m.fullName} ${m.phone} ${m.id}`} onSelect={() => go(`/admin/people/${m.id}`)} className={itemCls}>
                      <Avatar name={m.fullName} src={m.photoUrl} size="xs" />
                      <span className="flex-1 truncate">{m.fullName}</span>
                      <span className="text-xs text-fg-3">{formatPhone(m.phone)}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {actions.length > 0 && (
                <Command.Group heading="Quick actions" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-fg-3">
                  {actions.map((a) => (
                    <Command.Item key={a.label} value={a.label} onSelect={() => go(a.to)} className={itemCls}>
                      <a.icon />
                      <span className="flex-1">{a.label}</span>
                      <CornerDownLeft className="opacity-0 [[data-selected=true]_&]:opacity-100" />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              <Command.Group heading="Go to" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-fg-3">
                {ADMIN_NAV.flatMap((s) => s.items)
                  .filter((i) => visible(i, can))
                  .map((i) => (
                    <Command.Item key={i.to} value={`go ${i.label}`} onSelect={() => go(i.to)} className={itemCls}>
                      <i.icon />
                      {i.label}
                    </Command.Item>
                  ))}
              </Command.Group>
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
