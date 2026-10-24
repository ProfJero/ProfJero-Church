import { useState } from 'react';
import { cn, initials } from '@/lib/utils';
import { cld } from '@/lib/cloudinary';

const palette = [
  'bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-200',
  'bg-gold-100 text-gold-700 dark:bg-gold-500/20 dark:text-gold-300',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
  'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200',
  'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const sizes = { xs: 'size-6 text-[10px]', sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg', xl: 'size-20 text-2xl', '2xl': 'size-28 text-3xl' };
const px = { xs: 48, sm: 64, md: 80, lg: 112, xl: 160, '2xl': 224 };

export function Avatar({ name, src, size = 'md', className }: { name?: string; src?: string | null; size?: keyof typeof sizes; className?: string }) {
  const [failed, setFailed] = useState(false);
  const show = src && !failed;
  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 select-none place-items-center overflow-hidden rounded-full font-semibold',
        sizes[size],
        !show && palette[hash(name || '?') % palette.length],
        className,
      )}
      aria-hidden={!name}
      title={name}
    >
      {show ? (
        <img src={cld(src, { w: px[size], h: px[size], fill: true })} alt="" className="size-full object-cover" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        initials(name)
      )}
    </span>
  );
}
