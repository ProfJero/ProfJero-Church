import { useMemo, useRef, useState } from 'react';
import { Check, UserPlus, X } from 'lucide-react';
import { useMembers } from '@/lib/queries';
import { formatPhone, normalizePhone } from '@/lib/phone';
import { cn } from '@/lib/utils';
import type { Member } from '@/lib/types';
import { Avatar } from './ui/avatar';
import { fieldClass } from './ui/input';

export function matchMember(m: Member, q: string) {
  if (!q) return true;
  const needle = q.toLowerCase().trim();
  const digits = needle.replace(/\D/g, '');
  if (digits.length >= 3 && (m.phone?.includes(normalizePhone(digits).slice(-9)) || m.phone?.includes(digits))) return true;
  return `${m.fullName} ${m.email ?? ''} ${(m.tags ?? []).join(' ')}`.toLowerCase().includes(needle);
}

/**
 * Inline combobox for choosing a member (works inside dialogs and bottom sheets).
 * Pass allowFreeText to accept a name that isn't in the directory (e.g. a visitor).
 */
export function MemberPicker({
  value,
  onChange,
  placeholder = 'Search by name or phone…',
  allowFreeText,
  exclude,
  autoFocus,
  id,
}: {
  value: { id?: string | null; name: string } | null;
  onChange: (v: { id: string | null; name: string; member?: Member } | null) => void;
  placeholder?: string;
  allowFreeText?: boolean;
  exclude?: Set<string>;
  autoFocus?: boolean;
  id?: string;
}) {
  const { data: members, loading } = useMembers();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (!q.trim()) return members.filter((m) => !exclude?.has(m.id)).slice(0, 8);
    return members.filter((m) => !exclude?.has(m.id) && matchMember(m, q)).slice(0, 8);
  }, [members, q, exclude]);

  if (value) {
    return (
      <div className={cn(fieldClass, 'flex h-10 items-center gap-2 pl-2 pr-1')}>
        <Avatar name={value.name} size="xs" />
        <span className="min-w-0 flex-1 truncate text-sm">{value.name}</span>
        {!value.id && <span className="text-xs text-fg-3">not in directory</span>}
        <button
          type="button"
          aria-label="Clear"
          className="grid size-7 place-items-center rounded-lg text-fg-3 hover:bg-surface-2"
          onClick={() => {
            onChange(null);
            setQ('');
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  const pick = (m: Member) => {
    onChange({ id: m.id, name: m.fullName, member: m });
    setOpen(false);
    setQ('');
  };

  return (
    <div className="relative">
      <input
        id={id}
        ref={inputRef}
        autoFocus={autoFocus}
        value={q}
        placeholder={loading ? 'Loading members…' : placeholder}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (results[active]) pick(results[active]);
            else if (allowFreeText && q.trim()) onChange({ id: null, name: q.trim() });
          }
        }}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        className={cn(fieldClass, 'h-10')}
      />
      {open && (results.length > 0 || (allowFreeText && q.trim())) && (
        <ul role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow-pop)]">
          {results.map((m, i) => (
            <li key={m.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(m)}
                onMouseEnter={() => setActive(i)}
                className={cn('flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left', i === active && 'bg-surface-2')}
              >
                <Avatar name={m.fullName} src={m.photoUrl} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{m.fullName}</span>
                  <span className="block truncate text-xs text-fg-3">{formatPhone(m.phone) || m.email || '—'}</span>
                </span>
                {i === active && <Check className="size-4 text-fg-3" />}
              </button>
            </li>
          ))}
          {allowFreeText && q.trim() && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onChange({ id: null, name: q.trim() })}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-fg-2 hover:bg-surface-2"
              >
                <span className="grid size-8 place-items-center rounded-full bg-surface-2">
                  <UserPlus className="size-4" />
                </span>
                Use “{q.trim()}” (not in directory)
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
