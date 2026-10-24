import { describe, it, expect } from 'vitest';
import { segmentInfo, toGsmSafe, renderMessage, missingFields, extractFields } from './sms';

describe('segmentInfo', () => {
  it('counts GSM pages', () => {
    expect(segmentInfo('a'.repeat(160)).pages).toBe(1);
    expect(segmentInfo('a'.repeat(161)).pages).toBe(2);
    expect(segmentInfo('a'.repeat(306)).pages).toBe(2);
    expect(segmentInfo('a'.repeat(307)).pages).toBe(3);
    expect(segmentInfo('').pages).toBe(0);
  });
  it('counts extension chars double', () => {
    expect(segmentInfo('€'.repeat(80)).length).toBe(160);
    expect(segmentInfo('€'.repeat(81)).pages).toBe(2);
  });
  it('switches to Unicode for cedi sign and emoji', () => {
    const s = segmentInfo('Give GH₵ 50');
    expect(s.encoding).toBe('Unicode');
    expect(s.unicodeChars).toContain('₵');
    expect(segmentInfo('🙏'.repeat(35)).pages).toBe(1);
    expect(segmentInfo('🙏'.repeat(36)).pages).toBe(2);
  });
});

describe('toGsmSafe', () => {
  it('replaces smart characters', () => {
    const out = toGsmSafe('“Hello” – it’s GH₵50…');
    expect(out).toBe('"Hello" - it\'s GHS 50...');
    expect(segmentInfo(out).encoding).toBe('GSM-7');
  });
});

describe('personalisation', () => {
  const msg = 'Hi {first_name|Beloved}, see you {day}. {Name}';
  it('extracts fields', () => expect(extractFields(msg)).toEqual(['first_name', 'day', 'name']));
  it('renders with fallbacks', () => {
    expect(renderMessage(msg, { day: 'Sunday', name: 'Ama Mensah' })).toBe('Hi Beloved, see you Sunday. Ama Mensah');
  });
  it('reports missing required fields', () => {
    expect(missingFields(msg, { first_name: '', day: '' })).toEqual(['day', 'name']);
  });
});
