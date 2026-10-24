import { cloneElement, forwardRef, isValidElement, useId, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const fieldClass =
  'w-full rounded-xl border border-line-strong bg-surface px-3.5 text-sm text-fg placeholder:text-fg-3 transition-[border,box-shadow] outline-none focus:border-brand-500 focus:ring-4 focus:ring-[var(--color-ring)]/40 disabled:opacity-60 disabled:bg-surface-2 aria-[invalid=true]:border-danger';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { leading?: ReactNode; trailing?: ReactNode }>(
  function Input({ className, leading, trailing, ...props }, ref) {
    if (!leading && !trailing) return <input ref={ref} className={cn(fieldClass, 'h-10', className)} {...props} />;
    return (
      <div className="relative">
        {leading && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-3 [&_svg]:size-4">{leading}</span>}
        <input ref={ref} className={cn(fieldClass, 'h-10', leading && 'pl-9', trailing && 'pr-10', className)} {...props} />
        {trailing && <span className="absolute inset-y-0 right-2 flex items-center">{trailing}</span>}
      </div>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(fieldClass, 'min-h-24 py-2.5 leading-relaxed', className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(fieldClass, 'h-10 appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-3" />
    </div>
  );
});

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  const auto = useId();
  // Link the label (and hint) to a single control child automatically.
  const single = isValidElement(children) && typeof children.type !== 'string' ? (children as ReactElement<{ id?: string; 'aria-describedby'?: string }>) : isValidElement(children) && ['input', 'select', 'textarea'].includes(children.type as string) ? (children as ReactElement<{ id?: string; 'aria-describedby'?: string }>) : null;
  const id = htmlFor ?? single?.props.id ?? (single ? auto : undefined);
  const hintId = `${auto}-hint`;
  const describe = error || hint ? hintId : undefined;
  const control = single && (!single.props.id || describe) ? cloneElement(single, { id, 'aria-describedby': single.props['aria-describedby'] ?? describe }) : children;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-fg-2">
          {label}
          {required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
        </label>
      )}
      {control}
      {error ? <p id={hintId} className="text-xs text-danger">{error}</p> : hint ? <p id={hintId} className="text-xs text-fg-3">{hint}</p> : null}
    </div>
  );
}

/** Label + input wired together with an id. */
export function TextField({
  label,
  hint,
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode; error?: ReactNode; leading?: ReactNode }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={props.required} className={className} htmlFor={id}>
      <Input id={id} aria-invalid={!!error} {...props} />
    </Field>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-3" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(fieldClass, 'h-10 pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden')}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-fg-3 hover:bg-surface-2 hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  const control = (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      className="relative h-6 w-10 shrink-0 cursor-pointer rounded-full bg-surface-3 transition-colors data-[state=checked]:bg-accent disabled:opacity-50"
    >
      <SwitchPrimitive.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
  if (!label) return control;
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-fg-3">{description}</span>}
      </label>
      {control}
    </div>
  );
}

export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className={cn('size-4 cursor-pointer rounded border-line-strong accent-[var(--color-accent)]', className)} {...props} />;
}
