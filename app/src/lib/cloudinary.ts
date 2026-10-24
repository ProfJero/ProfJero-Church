import { api } from './api';
import { config } from '@/config';

export type UploadFolder = 'avatars' | 'members' | 'events' | 'devotionals' | 'sermons' | 'announcements' | 'receipts' | 'branding';

interface Signature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}

export function cloudinaryConfigured() {
  return Boolean(config.cloudinaryCloudName && (config.cloudinaryUploadPreset || config.apiUrl));
}

/** Shrinks big phone photos before upload — saves members' data bundles. */
async function downscale(file: File, max = 1600): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5e6) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((res) => canvas.toBlob((b) => res(b ?? file), 'image/jpeg', 0.86));
  } catch {
    return file;
  }
}

export async function uploadToCloudinary(file: File, folder: UploadFolder, onProgress?: (pct: number) => void): Promise<string> {
  const isImage = file.type.startsWith('image/');
  const resource = isImage ? 'image' : file.type.startsWith('audio/') || file.type.startsWith('video/') ? 'video' : 'raw';
  const body = new FormData();
  body.append('file', isImage ? await downscale(file) : file);

  let cloudName = config.cloudinaryCloudName;
  if (config.cloudinaryUploadPreset) {
    body.append('upload_preset', config.cloudinaryUploadPreset);
    body.append('folder', `cwc/${folder}`);
  } else {
    const sig = await api<Signature>('/v1/media/sign', { method: 'POST', json: { folder } });
    cloudName = sig.cloudName || cloudName;
    body.append('api_key', sig.apiKey);
    body.append('timestamp', String(sig.timestamp));
    body.append('signature', sig.signature);
    body.append('folder', sig.folder);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/${resource}/upload`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && res.secure_url) resolve(res.secure_url);
        else reject(new Error(res.error?.message || 'Upload failed'));
      } catch {
        reject(new Error('Upload failed'));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed — check your connection.'));
    xhr.send(body);
  });
}

/** Delivery URL with automatic format/quality and a width cap. */
export function cld(url: string | undefined | null, opts: { w?: number; h?: number; fill?: boolean } = {}) {
  if (!url) return undefined;
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  const t = ['f_auto', 'q_auto'];
  if (opts.w) t.push(`w_${opts.w}`);
  if (opts.h) t.push(`h_${opts.h}`);
  if (opts.fill) t.push('c_fill', 'g_auto');
  else if (opts.w || opts.h) t.push('c_limit');
  return url.replace('/upload/', `/upload/${t.join(',')}/`);
}
