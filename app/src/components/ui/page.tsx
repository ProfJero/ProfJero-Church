import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDocumentTitle } from '@/lib/hooks';

export function Page({ children, className, width = 'default' }: { children: ReactNode; className?: string; width?: 'default' | 'narrow' | 'wide' }) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 pb-28 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-12',
        width === 'narrow' ? 'max-w-3xl' : width === 'wide' ? 'max-w-[1600px]' : 'max-w-7xl',
        'animate-fade-in',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
  eyebrow,
  docTitle,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
  eyebrow?: ReactNode;
  docTitle?: string;
}) {
  useDocumentTitle(docTitle ?? (typeof title === 'string' ? title : ''));
  return (
    <header className="mb-5 sm:mb-7">
      {back && (
        <Link to={back.to} className="mb-3 inline-flex items-center gap-1 rounded-md text-[13px] font-medium text-fg-3 hover:text-fg">
          <ChevronLeft className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <div className="mb-1 text-[13px] font-medium text-fg-3">{eyebrow}</div>}
          <h1 className="text-[clamp(1.375rem,2.6vw,1.75rem)] font-semibold leading-tight tracking-tight text-balance">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-fg-3 text-pretty">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Section({ title, description, action, children, className }: { title?: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('mt-8 first:mt-0', className)}>
      {(title || action) && (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
            {description && <p className="text-[13px] text-fg-3">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center', className)}>{children}</div>;
}

export function DescriptionList({ items, className }: { items: { label: ReactNode; value: ReactNode; full?: boolean }[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2', className)}>
      {items.map((it, i) => (
        <div key={i} className={cn('min-w-0', it.full && 'sm:col-span-2')}>
          <dt className="text-xs font-medium text-fg-3">{it.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-fg">{it.value || <span className="text-fg-3">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
