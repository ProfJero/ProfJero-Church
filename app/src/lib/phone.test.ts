import { describe, it, expect } from 'vitest';
import { normalizePhone, isValidPhone, formatPhone, networkOf } from './phone';

describe('normalizePhone', () => {
  it.each([
    ['0241234567', '233241234567'],
    ['024 123 4567', '233241234567'],
    ['+233 24 123 4567', '233241234567'],
    ['233241234567', '233241234567'],
    ['2330241234567', '233241234567'],
    ['241234567', '233241234567'],
    ['00233241234567', '233241234567'],
    ['+44 7700 900123', '447700900123'],
    ['', ''],
  ])('%s → %s', (input, out) => expect(normalizePhone(input)).toBe(out));
});

describe('validation & display', () => {
  it('validates Ghana mobiles', () => {
    expect(isValidPhone('0241234567')).toBe(true);
    expect(isValidPhone('0551234567')).toBe(true);
    expect(isValidPhone('0311234567')).toBe(false);
    expect(isValidPhone('024123')).toBe(false);
  });
  it('formats for humans', () => {
    expect(formatPhone('233241234567')).toBe('024 123 4567');
    expect(formatPhone('+447700900123')).toBe('+447700900123');
  });
  it('detects networks', () => {
    expect(networkOf('0244000000')).toBe('MTN');
    expect(networkOf('0204000000')).toBe('Telecel');
    expect(networkOf('0274000000')).toBe('AT');
  });
});
