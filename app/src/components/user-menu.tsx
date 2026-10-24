import { useNavigate } from 'react-router';
import { LogOut, Moon, Sun, Monitor, User, LayoutDashboard, Smartphone } from 'lucide-react';
import { useAuth, signOut } from '@/lib/auth';
import { ROLE_META } from '@/lib/permissions';
import { useTheme, type ThemePref } from '@/lib/theme';
import { Avatar } from './ui/avatar';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from './ui/menu';
import { cn } from '@/lib/utils';

export function ThemeSwitcher({ className }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  const opts: { v: ThemePref; icon: typeof Sun; label: string }[] = [
    { v: 'light', icon: Sun, label: 'Light' },
    { v: 'dark', icon: Moon, label: 'Dark' },
    { v: 'system', icon: Monitor, label: 'System' },
  ];
  return (
    <div role="radiogroup" aria-label="Theme" className={cn('flex gap-0.5 rounded-lg bg-surface-2 p-0.5', className)}>
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={theme === o.v}
          aria-label={o.label}
          title={o.label}
          onClick={(e) => {
            e.preventDefault();
            setTheme(o.v);
          }}
          className={cn('grid h-7 flex-1 place-items-center rounded-md text-fg-3', theme === o.v && 'bg-surface text-fg shadow-sm dark:bg-surface-3')}
        >
          <o.icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}

export function UserMenu({ variant = 'avatar', context }: { variant?: 'avatar' | 'full'; context: 'admin' | 'member' }) {
  const { profile, user, staff } = useAuth();
  const navigate = useNavigate();
  const name = profile?.fullName || user?.displayName || 'You';
  return (
    <Menu>
      <MenuTrigger
        className={cn(
          'flex min-w-0 items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
          variant === 'full' ? 'w-full p-2 text-left hover:bg-surface-2' : 'p-0.5',
        )}
        aria-label="Account menu"
      >
        <Avatar name={name} src={profile?.photoUrl} size={variant === 'full' ? 'sm' : 'sm'} />
        {variant === 'full' && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">{name}</span>
            <span className="block truncate text-[11px] text-fg-3">{profile ? ROLE_META[profile.role]?.label : ''}</span>
          </span>
        )}
      </MenuTrigger>
      <MenuContent align={variant === 'full' ? 'start' : 'end'} className="w-60">
        <MenuLabel>
          <span className="block truncate text-sm font-medium text-fg">{name}</span>
          <span className="block truncate font-normal">{profile?.email || profile?.phone || ''}</span>
        </MenuLabel>
        <div className="px-1.5 py-1.5">
          <ThemeSwitcher />
        </div>
        <MenuSeparator />
        {context === 'admin' ? (
          <MenuItem icon={<Smartphone />} onSelect={() => navigate('/')}>
            Member app
          </MenuItem>
        ) : (
          staff && (
            <MenuItem icon={<LayoutDashboard />} onSelect={() => navigate('/admin')}>
              Church admin
            </MenuItem>
          )
        )}
        <MenuItem icon={<User />} onSelect={() => navigate('/me')}>
          My profile
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={<LogOut />}
          danger
          onSelect={async () => {
            await signOut();
            navigate('/login', { replace: true });
          }}
        >
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
