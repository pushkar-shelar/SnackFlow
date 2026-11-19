import { describe, it, expect } from 'vitest';
import { getFinancialYear } from '../src/numbering/index.js';

describe('Timezone & Financial Year Correctness (Asia/Kolkata Cloud Invariant)', () => {
  it('correctly attributes 31 March 2026, 23:30 IST to FY 2526', () => {
    // 23:30 IST on 31 March is 18:00 UTC on 31 March
    const dateUtc = new Date('2026-03-31T18:00:00.000Z');
    const fy = getFinancialYear(dateUtc);
    expect(fy).toBe('2526');
  });

  it('correctly attributes 1 April 2026, 00:30 IST to FY 2627 (despite UTC being 31 March)', () => {
    // 00:30 IST on 1 April is 19:00 UTC on 31 March
    const dateUtc = new Date('2026-03-31T19:00:00.000Z');
    const fy = getFinancialYear(dateUtc);
    expect(fy).toBe('2627');
  });

  it('handles standard mid-year date in FY 2627', () => {
    const dateUtc = new Date('2026-07-15T10:00:00.000Z');
    const fy = getFinancialYear(dateUtc);
    expect(fy).toBe('2627');
  });

  it('handles standard Q4 date in January 2027 in FY 2627', () => {
    const dateUtc = new Date('2027-01-15T10:00:00.000Z');
    const fy = getFinancialYear(dateUtc);
    expect(fy).toBe('2627');
  });
});
