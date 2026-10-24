import type { Env } from './env';
import { hex, HttpError } from './util';

const FOLDERS = ['avatars', 'members', 'events', 'devotionals', 'sermons', 'announcements', 'receipts', 'branding'];

/** Signs an upload so the browser can send the file straight to Cloudinary. */
export async function signUpload(env: Env, folder: string, staff: boolean) {
  if (!env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET || !env.CLOUDINARY_CLOUD_NAME) throw new HttpError(503, 'Uploads are not configured', 'not_configured');
  if (!FOLDERS.includes(folder)) throw new HttpError(400, 'Unknown folder');
  if (!staff && folder !== 'avatars') throw new HttpError(403, 'Members can only upload a profile photo');
  const timestamp = Math.floor(Date.now() / 1000);
  const fullFolder = `cwc/${folder}`;
  const toSign = `folder=${fullFolder}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
  const signature = hex(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(toSign)));
  return { signature, timestamp, apiKey: env.CLOUDINARY_API_KEY, cloudName: env.CLOUDINARY_CLOUD_NAME, folder: fullFolder };
}
