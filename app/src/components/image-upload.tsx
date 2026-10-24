import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { cloudinaryConfigured, cld, uploadToCloudinary, type UploadFolder } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function ImageUpload({
  value,
  onChange,
  folder,
  aspect = 'aspect-[16/9]',
  label = 'Upload image',
  accept = 'image/*',
}: {
  value?: string;
  onChange: (url: string) => void;
  folder: UploadFolder;
  aspect?: string;
  label?: string;
  accept?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [urlMode, setUrlMode] = useState(false);
  const configured = cloudinaryConfigured();

  async function handle(file?: File) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) return toast.error('That file is larger than 25 MB.');
    setProgress(0);
    try {
      const url = await uploadToCloudinary(file, folder, setProgress);
      onChange(url);
      toast.success('Uploaded');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProgress(null);
      if (input.current) input.current.value = '';
    }
  }

  if (!configured || urlMode) {
    return (
      <div className="space-y-2">
        <Input placeholder="https://… image link" value={value ?? ''} onChange={(e) => onChange(e.target.value)} leading={<Link2 />} />
        <p className="text-xs text-fg-3">
          {configured ? (
            <button type="button" className="font-medium text-accent hover:underline" onClick={() => setUrlMode(false)}>
              Upload a file instead
            </button>
          ) : (
            'Paste an image link. Configure Cloudinary to upload files directly.'
          )}
        </p>
      </div>
    );
  }

  return (
    <div>
      <input ref={input} type="file" accept={accept} className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
      {value ? (
        <div className={cn('group relative overflow-hidden rounded-xl border border-line bg-surface-2', aspect)}>
          <img src={cld(value, { w: 800 })} alt="" className="size-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/60 to-transparent p-2">
            <Button size="xs" variant="secondary" onClick={() => input.current?.click()} disabled={progress !== null}>
              Replace
            </Button>
            <Button size="xs" variant="secondary" onClick={() => onChange('')} icon={<Trash2 />} aria-label="Remove image" />
          </div>
          {progress !== null && <Overlay progress={progress} />}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handle(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            'relative flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-line-strong bg-surface-2/50 text-sm text-fg-3 transition-colors hover:border-brand-400 hover:text-fg-2',
            aspect,
          )}
        >
          <ImagePlus className="size-6" />
          <span className="font-medium">{label}</span>
          <span className="text-xs">Tap to choose or drag a file here</span>
          {progress !== null && <Overlay progress={progress} />}
        </button>
      )}
      <button type="button" className="mt-1.5 text-xs font-medium text-fg-3 hover:text-fg" onClick={() => setUrlMode(true)}>
        Or paste a link
      </button>
    </div>
  );
}

function Overlay({ progress }: { progress: number }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-surface/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-2 text-sm font-medium text-fg">
        <Loader2 className="size-5 animate-spin" />
        {progress}%
      </div>
    </div>
  );
}
