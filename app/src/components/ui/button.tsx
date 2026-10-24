import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'soft' | 'gold';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-[background,color,box-shadow,transform] duration-150 select-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)] [&_svg]:shrink-0';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(16_24_40/0.12)] hover:brightness-110',
  secondary: 'bg-surface-2 text-fg hover:bg-surface-3',
  outline: 'border border-line-strong bg-surface text-fg hover:bg-surface-2 shadow-[0_1px_1px_rgb(16_24_40/0.04)]',
  ghost: 'text-fg-2 hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger text-white hover:brightness-110 dark:text-black',
  soft: 'bg-accent-soft text-accent-soft-fg hover:brightness-95 dark:hover:brightness-125',
  gold: 'bg-gold-500 text-white hover:bg-gold-600',
};

const sizes: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs [&_svg]:size-3.5 rounded-lg',
  sm: 'h-8 px-3 text-[13px] [&_svg]:size-4 rounded-lg',
  md: 'h-10 px-4 text-sm [&_svg]:size-4',
  lg: 'h-12 px-5 text-[15px] [&_svg]:size-5',
  icon: 'size-10 [&_svg]:size-[18px]',
  'icon-sm': 'size-8 rounded-lg [&_svg]:size-4',
};

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...props}>
      {loading ? <Loader2 className="animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
  ...props
}: LinkProps & { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}
