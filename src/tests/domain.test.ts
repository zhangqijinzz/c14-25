import { describe, expect, it } from 'vitest';
import { calculateProjection, editingHint, validateScenario, SAMPLE_SCENARIOS } from '../domain';

describe('scenario domain', () => {
  it('calculates monthly contributions and inflation-adjusted value', () => {
    const projection = calculateProjection(SAMPLE_SCENARIOS[0]);
    expect(projection.points).toHaveLength(21);
    expect(projection.totalInvested).toBe(390000);
    expect(projection.finalValue).toBeGreaterThan(projection.totalInvested);
    expect(projection.finalRealValue).toBeLessThan(projection.finalValue);
  });

  it('rejects unreasonable years and rates', () => {
    const errors = validateScenario({ ...SAMPLE_SCENARIOS[0], years: 61, feeRate: -1 });
    expect(errors.years).toBeTruthy();
    expect(errors.feeRate).toBeTruthy();
  });

  it('keeps zero contribution scenarios valid', () => {
    const scenario = { ...SAMPLE_SCENARIOS[0], principal: 0, recurring: 0 };
    expect(validateScenario(scenario)).toEqual({});
    expect(calculateProjection(scenario).finalValue).toBe(0);
  });

  it('uses different wording for in-flight hints vs blocking errors', () => {
    const invalid = { ...SAMPLE_SCENARIOS[0], years: 99 };
    expect(validateScenario(invalid).years).toMatch(/无法保存/);
    expect(editingHint(invalid, 'years')).toMatch(/输入中/);
    expect(editingHint({ ...SAMPLE_SCENARIOS[0], years: 20.5 }, 'years')).toMatch(/整数/);
    expect(editingHint(SAMPLE_SCENARIOS[0], 'years')).toBeNull();
    // 口径不变：原来会被拦的输入仍然会被拦。
    expect(validateScenario({ ...SAMPLE_SCENARIOS[0], years: 61, feeRate: -1 })).toMatchObject({ years: expect.any(String), feeRate: expect.any(String) });
  });
});
