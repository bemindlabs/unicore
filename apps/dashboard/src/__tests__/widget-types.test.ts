/**
 * Unit tests for widget type definitions and config validation.
 * These tests run in Node with Jest (no DOM required).
 */

import type {
  WidgetConfig,
  DashboardConfig,
  WidgetType,
  MetricValue,
  TrendData,
} from '../types/widget';

// ─── WidgetConfig shape ───────────────────────────────────────────────────────

describe('WidgetConfig', () => {
  it('accepts a minimal valid config', () => {
    const config: WidgetConfig = {
      id: 'revenue-1',
      type: 'revenue',
      title: 'Revenue',
      enabled: true,
    };
    expect(config.id).toBe('revenue-1');
    expect(config.type).toBe('revenue');
    expect(config.enabled).toBe(true);
  });

  it('accepts all widget types', () => {
    const types: WidgetType[] = [
      'revenue',
      'orders',
      'inventory',
      'mrr',
      'churn',
      'signups',
      'activity',
      'chart',
    ];
    types.forEach((type) => {
      const cfg: WidgetConfig = { id: `${type}-1`, type, title: type, enabled: true };
      expect(cfg.type).toBe(type);
    });
  });

  it('accepts optional fields', () => {
    const config: WidgetConfig = {
      id: 'chart-1',
      type: 'chart',
      title: 'Revenue Chart',
      size: '2x1',
      enabled: true,
      refreshInterval: 60,
      options: { metric: 'revenue', period: '30d' },
    };
    expect(config.size).toBe('2x1');
    expect(config.refreshInterval).toBe(60);
    expect(config.options?.['metric']).toBe('revenue');
  });
});

// ─── DashboardConfig ──────────────────────────────────────────────────────────

describe('DashboardConfig', () => {
  it('accepts a complete dashboard config', () => {
    const dashConfig: DashboardConfig = {
      columns: 4,
      refreshInterval: 60,
      widgets: [
        { id: 'r1', type: 'revenue', title: 'Revenue', enabled: true },
        { id: 'o1', type: 'orders', title: 'Orders', enabled: true },
        { id: 'a1', type: 'activity', title: 'Activity', enabled: false },
      ],
    };
    expect(dashConfig.widgets).toHaveLength(3);
    expect(dashConfig.columns).toBe(4);
  });

  it('enabled flag filters widgets correctly', () => {
    const dashConfig: DashboardConfig = {
      widgets: [
        { id: 'r1', type: 'revenue', title: 'Revenue', enabled: true },
        { id: 'o1', type: 'orders', title: 'Orders', enabled: false },
        { id: 'm1', type: 'mrr', title: 'MRR', enabled: true },
      ],
    };
    const enabled = dashConfig.widgets.filter((w) => w.enabled);
    expect(enabled).toHaveLength(2);
    expect(enabled.map((w) => w.type)).toEqual(['revenue', 'mrr']);
  });
});

// ─── MetricValue ──────────────────────────────────────────────────────────────

describe('MetricValue', () => {
  it('formats currency metrics', () => {
    const metric: MetricValue = {
      current: 45231.89,
      previous: 40000,
      currency: 'USD',
      formatted: '$45,231.89',
    };
    expect(metric.formatted).toBe('$45,231.89');
    expect(metric.current).toBeGreaterThan(metric.previous!);
  });

  it('formats count metrics without currency', () => {
    const metric: MetricValue = {
      current: 356,
      previous: 329,
      formatted: '356',
    };
    expect(metric.currency).toBeUndefined();
    expect(metric.formatted).toBe('356');
  });
});

// ─── TrendData ────────────────────────────────────────────────────────────────

describe('TrendData', () => {
  it('represents a positive trend', () => {
    const trend: TrendData = { value: 12.3, positive: true, label: 'vs last month' };
    expect(trend.positive).toBe(true);
    expect(trend.value).toBeGreaterThan(0);
  });

  it('represents a negative trend', () => {
    const trend: TrendData = { value: -2.4, positive: false };
    expect(trend.positive).toBe(false);
    expect(trend.value).toBeLessThan(0);
  });

  it('churn improvement is positive even with negative delta', () => {
    // Churn going down is a positive trend
    const trend: TrendData = { value: -0.3, positive: true, label: 'vs last month' };
    expect(trend.positive).toBe(true);
  });
});
