import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowDownRight, ArrowUpRight, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Card({ children, className, as: As = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' }) {
  return <As className={cn('card', className)}>{children}</As>;
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pb-3 pt-4', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-fg-2 [&_svg]:size-4">{icon}</span>}
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold tracking-tight">{title}</h3>
          {description && <p className="mt-0.5 text-[13px] text-fg-3">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardLink({ to, children = 'View all' }: { to: string; children?: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-0.5 rounded-md text-[13px] font-medium text-accent hover:underline dark:text-brand-300">
      {children}
      <ChevronRight className="size-3.5" />
    </Link>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  trend,
  to,
  tone = 'brand',
  loading,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  trend?: number | null; // fractional change, e.g. 0.12 = +12%
  to?: string;
  tone?: 'brand' | 'gold' | 'success' | 'info' | 'danger';
  loading?: boolean;
}) {
  const toneCls = {
    brand: 'bg-accent-soft text-accent-soft-fg',
    gold: 'bg-gold-50 text-gold-600 dark:bg-gold-500/15 dark:text-gold-300',
    success: 'bg-success-soft text-success',
    info: 'bg-info-soft text-info',
    danger: 'bg-danger-soft text-danger',
  }[tone];
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-fg-3">{label}</span>
        {icon && <span className={cn('hidden size-8 shrink-0 place-items-center rounded-lg sm:grid [&_svg]:size-4', toneCls)}>{icon}</span>}
      </div>
      {loading ? (
        <div className="skeleton mt-3 h-7 w-24" />
      ) : (
        <div className="mt-2 truncate text-[clamp(1.25rem,2.4vw,1.625rem)] font-semibold tracking-tight">{value}</div>
      )}
      <div className="mt-1 flex min-h-5 items-center gap-1.5 text-xs text-fg-3">
        {trend != null && isFinite(trend) && (
          <span className={cn('inline-flex items-center gap-0.5 font-medium', trend >= 0 ? 'text-success' : 'text-danger')}>
            {trend >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(trend * 100).toFixed(0)}%
          </span>
        )}
        <span className="truncate">{hint}</span>
      </div>
    </>
  );
  const cls = 'card block p-4 sm:p-5 transition-colors';
  return to ? (
    <Link to={to} className={cn(cls, 'hover:border-line-strong')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
