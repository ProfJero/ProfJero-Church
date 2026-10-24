/**
 * SMS page/unit maths matching ProfJero Connect billing:
 * GSM-7 → 160 chars (153 per page when longer); Unicode → 70 (67 per page).
 */
const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXT = '^{}\\[~]|€\f';
const BASIC = new Set(Array.from(GSM_BASIC));
const EXT = new Set(Array.from(GSM_EXT));

export interface SegmentInfo {
  encoding: 'GSM-7' | 'Unicode';
  length: number; // in encoding units (GSM ext chars count as 2)
  pages: number;
  perPage: number;
  remaining: number; // chars left in current page
  unicodeChars: string[];
}

export function segmentInfo(text: string): SegmentInfo {
  const chars = Array.from(text);
  const unicodeChars = [...new Set(chars.filter((c) => !BASIC.has(c) && !EXT.has(c)))];
  if (unicodeChars.length === 0) {
    const length = chars.reduce((n, c) => n + (EXT.has(c) ? 2 : 1), 0);
    const perPage = length > 160 ? 153 : 160;
    const pages = length === 0 ? 0 : Math.ceil(length / perPage);
    return { encoding: 'GSM-7', length, pages, perPage, remaining: pages * perPage - length, unicodeChars };
  }
  // UTF-16 code units: emoji count as 2
  const length = text.length;
  const perPage = length > 70 ? 67 : 70;
  const pages = Math.ceil(length / perPage);
  return { encoding: 'Unicode', length, pages, perPage, remaining: pages * perPage - length, unicodeChars };
}

const REPLACEMENTS: Record<string, string> = {
  '₵': 'GHS ', '‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-', '…': '...', ' ': ' ',
  '•': '-', '´': "'", '`': "'",
};

/** Swap common "smart" characters for GSM-safe ones so messages bill as standard text. */
export function toGsmSafe(text: string): string {
  return Array.from(text.replace(/GH\s?₵\s*/g, 'GHS '))
    .map((c) => REPLACEMENTS[c] ?? c)
    .join('')
    .replace(/GHS {2,}/g, 'GHS ')
    .replace(/GHS (\d)/g, 'GHS $1');
}

/** Field placeholders: {first_name} or {first_name|Fallback}. */
const FIELD_RE = /\{([a-z_][a-z0-9_]*)(?:\|([^}]*))?\}/gi;

export function extractFields(message: string): string[] {
  return [...new Set(Array.from(message.matchAll(FIELD_RE), (m) => m[1].toLowerCase()))];
}

export function renderMessage(message: string, fields: Record<string, string | undefined>): string {
  return message.replace(FIELD_RE, (_m, key: string, fallback?: string) => {
    const v = fields[key.toLowerCase()];
    return v && v.trim() ? v : fallback ?? '';
  });
}

/** Fields without a value and without a fallback — ProfJero rejects these with 400. */
export function missingFields(message: string, fields: Record<string, string | undefined>): string[] {
  const missing: string[] = [];
  for (const m of message.matchAll(FIELD_RE)) {
    const key = m[1].toLowerCase();
    if (m[2] === undefined && !(fields[key] && fields[key]!.trim())) missing.push(key);
  }
  return [...new Set(missing)];
}

export const MESSAGE_FIELDS = [
  { key: 'first_name', label: 'First name', fallback: 'Beloved' },
  { key: 'last_name', label: 'Last name', fallback: '' },
  { key: 'name', label: 'Full name', fallback: 'Beloved' },
  { key: 'title', label: 'Title (Bro./Sis.)', fallback: '' },
  { key: 'phone', label: 'Phone', fallback: '' },
  { key: 'group', label: 'Group', fallback: 'church' },
];
