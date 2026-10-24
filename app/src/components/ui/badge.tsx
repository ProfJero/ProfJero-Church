import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { BadgeTone } from '@/lib/permissions';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-fg-2 ring-line',
  brand: 'bg-accent-soft text-accent-soft-fg ring-brand-200/60 dark:ring-brand-500/20',
  success: 'bg-success-soft text-success ring-success/15',
  warning: 'bg-warning-soft text-warning ring-warning/15',
  danger: 'bg-danger-soft text-danger ring-danger/15',
  info: 'bg-info-soft text-info ring-info/15',
  gold: 'bg-gold-50 text-gold-700 ring-gold-300/50 dark:bg-gold-500/15 dark:text-gold-300 dark:ring-gold-500/20',
};

export function Badge({ tone = 'neutral', dot, children, className }: { tone?: BadgeTone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
