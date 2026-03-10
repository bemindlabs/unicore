import { evaluateCondition, evaluateConditions } from '../src/common/condition-evaluator';
import type { TriggerCondition } from '../src/schema/workflow-definition.schema';

describe('evaluateCondition', () => {
  const payload = {
    payload: {
      amount: 500,
      status: 'pending',
      tags: 'urgent,vip',
      nested: { deep: 42 },
    },
  };

  it('eq — matches equal value', () => {
    const cond: TriggerCondition = { field: 'payload.status', operator: 'eq', value: 'pending' };
    expect(evaluateCondition(cond, payload)).toBe(true);
  });

  it('eq — rejects non-equal value', () => {
    const cond: TriggerCondition = { field: 'payload.status', operator: 'eq', value: 'done' };
    expect(evaluateCondition(cond, payload)).toBe(false);
  });

  it('neq — matches non-equal value', () => {
    const cond: TriggerCondition = { field: 'payload.status', operator: 'neq', value: 'done' };
    expect(evaluateCondition(cond, payload)).toBe(true);
  });

  it('gt — matches when actual > expected', () => {
    const cond: TriggerCondition = { field: 'payload.amount', operator: 'gt', value: 100 };
    expect(evaluateCondition(cond, payload)).toBe(true);
  });

  it('gt — rejects when actual <= expected', () => {
    const cond: TriggerCondition = { field: 'payload.amount', operator: 'gt', value: 500 };
    expect(evaluateCondition(cond, payload)).toBe(false);
  });

  it('gte — matches equal value', () => {
    const cond: TriggerCondition = { field: 'payload.amount', operator: 'gte', value: 500 };
    expect(evaluateCondition(cond, payload)).toBe(true);
  });

  it('lt — matches when actual < expected', () => {
    const cond: TriggerCondition = { field: 'payload.amount', operator: 'lt', value: 1000 };
    expect(evaluateCondition(cond, payload)).toBe(true);
  });

  it('lte — matches equal value', () => {
    const cond: TriggerCondition = { field: 'payload.amount', operator: 'lte', value: 500 };
    expect(evaluateCondition(cond, payload)).toBe(true);
  });

  it('contains — matches substring', () => {
    const cond: TriggerCondition = { field: 'payload.tags', operator: 'contains', value: 'vip' };
    expect(evaluateCondition(cond, payload)).toBe(true);
  });

  it('not_contains — rejects matching substring', () => {
    const cond: TriggerCondition = { field: 'payload.tags', operator: 'not_contains', value: 'vip' };
    expect(evaluateCondition(cond, payload)).toBe(false);
  });

  it('exists — matches present field', () => {
    const cond: TriggerCondition = { field: 'payload.amount', operator: 'exists' };
    expect(evaluateCondition(cond, payload)).toBe(true);
  });

  it('exists — rejects missing field', () => {
    const cond: TriggerCondition = { field: 'payload.missing', operator: 'exists' };
    expect(evaluateCondition(cond, payload)).toBe(false);
  });

  it('not_exists — matches missing field', () => {
    const cond: TriggerCondition = { field: 'payload.missing', operator: 'not_exists' };
    expect(evaluateCondition(cond, payload)).toBe(true);
  });

  it('handles nested dot paths', () => {
    const cond: TriggerCondition = { field: 'payload.nested.deep', operator: 'eq', value: 42 };
    expect(evaluateCondition(cond, payload)).toBe(true);
  });

  it('returns false for unknown operator', () => {
    const cond = { field: 'payload.amount', operator: 'unknown' as never };
    expect(evaluateCondition(cond, payload)).toBe(false);
  });
});

describe('evaluateConditions', () => {
  const payload = { payload: { amount: 200, status: 'new' } };

  it('returns true for empty conditions array', () => {
    expect(evaluateConditions([], payload)).toBe(true);
  });

  it('returns true when undefined conditions', () => {
    expect(evaluateConditions(undefined, payload)).toBe(true);
  });

  it('returns true when all conditions pass', () => {
    const conditions: TriggerCondition[] = [
      { field: 'payload.amount', operator: 'gt', value: 100 },
      { field: 'payload.status', operator: 'eq', value: 'new' },
    ];
    expect(evaluateConditions(conditions, payload)).toBe(true);
  });

  it('returns false when any condition fails', () => {
    const conditions: TriggerCondition[] = [
      { field: 'payload.amount', operator: 'gt', value: 100 },
      { field: 'payload.status', operator: 'eq', value: 'done' },
    ];
    expect(evaluateConditions(conditions, payload)).toBe(false);
  });
});
