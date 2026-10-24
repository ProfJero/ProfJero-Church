import type { ReactNode } from 'react';
import * as M from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;

export function MenuContent({ children, align = 'end', className }: { children: ReactNode; align?: 'start' | 'end' | 'center'; className?: string }) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={6}
        collisionPadding={12}
        className={cn(
          'z-50 min-w-48 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow-pop)] data-[state=open]:animate-fade-in',
          className,
        )}
      >
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function MenuItem({
  children,
  icon,
  onSelect,
  danger,
  disabled,
}: {
  children: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <M.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 text-sm outline-none data-[disabled]:opacity-50 [&_svg]:size-4',
        danger ? 'text-danger data-[highlighted]:bg-danger-soft' : 'text-fg data-[highlighted]:bg-surface-2 [&_svg]:text-fg-3',
      )}
    >
      {icon}
      {children}
    </M.Item>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <M.Label className="px-2.5 pb-1 pt-2 text-xs font-medium text-fg-3">{children}</M.Label>;
}

export function MenuSeparator() {
  return <M.Separator className="my-1 h-px bg-line" />;
}
