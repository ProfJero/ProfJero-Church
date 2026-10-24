/**
 * Phone helpers tuned for Ghana (+233) while accepting international numbers.
 * Stored format: digits only, with country code — e.g. 233241234567.
 */
const GH_MOBILE_PREFIXES = ['20', '23', '24', '25', '26', '27', '28', '29', '50', '53', '54', '55', '56', '57', '59'];

export function normalizePhone(input: string | null | undefined): string {
  if (!input) return '';
  const raw = String(input).trim();
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (raw.startsWith('+')) return digits; // explicit international number
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('233')) {
    // 2330241234567 → drop the stray trunk zero
    if (digits.length === 13 && digits[3] === '0') digits = '233' + digits.slice(4);
    return digits;
  }
  if (digits.startsWith('0') && digits.length === 10) return '233' + digits.slice(1);
  if (digits.length === 9 && GH_MOBILE_PREFIXES.includes(digits.slice(0, 2))) return '233' + digits;
  return digits;
}

export function isValidPhone(input: string | null | undefined): boolean {
  const n = normalizePhone(input);
  if (n.startsWith('233')) return n.length === 12 && GH_MOBILE_PREFIXES.includes(n.slice(3, 5));
  return n.length >= 8 && n.length <= 15;
}

/** Human display: 024 123 4567 for Ghana numbers, +XXX… otherwise. */
export function formatPhone(input: string | null | undefined): string {
  const n = normalizePhone(input);
  if (!n) return '';
  if (n.startsWith('233') && n.length === 12) {
    const local = '0' + n.slice(3);
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return '+' + n;
}

export function telHref(input: string | null | undefined) {
  const n = normalizePhone(input);
  return n ? `tel:+${n}` : undefined;
}

export function whatsappHref(input: string | null | undefined, text?: string) {
  const n = normalizePhone(input);
  if (!n) return undefined;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** Ghana network by prefix — helpful context when collecting MoMo payments. */
export function networkOf(input: string | null | undefined): string | null {
  const n = normalizePhone(input);
  if (!n.startsWith('233') || n.length !== 12) return null;
  const p = n.slice(3, 5);
  if (['24', '25', '53', '54', '55', '59'].includes(p)) return 'MTN';
  if (['20', '50'].includes(p)) return 'Telecel';
  if (['26', '27', '56', '57'].includes(p)) return 'AT';
  return null;
}
