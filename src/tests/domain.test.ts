import { describe, expect, it } from 'vitest';
import { blockingMessage, calculateProjection, hintMessage, validateScenario, SAMPLE_SCENARIOS } from '../domain';

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

  it('uses different wording for typing hints and blocking errors around the same rule', () => {
    const rule = validateScenario({ ...SAMPLE_SCENARIOS[0], years: 99 }).years;
    expect(rule).toBeTruthy();
    const hint = hintMessage(rule!);
    const blocking = blockingMessage(rule!);
    expect(hint).not.toBe(blocking);
    expect(hint).toContain('提示');
    expect(blocking).toContain('请修正');
    expect(hint).toContain(rule!);
    expect(blocking).toContain(rule!);
  });
});
