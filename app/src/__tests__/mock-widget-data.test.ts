/**
 * Unit tests for the mock widget data generators.
 * Validates shape, value ranges and referential integrity.
 */

// Jest globals are available via @types/jest; no import needed
import { mockWidgetData } from '../lib/widget-data';

describe('mockWidgetData.revenue', () => {
  it('returns a valid RevenueWidgetData shape', () => {
    const data = mockWidgetData.revenue();
    expect(data.metric).toBeDefined();
    expect(typeof data.metric.current).toBe('number');
    expect(typeof data.metric.formatted).toBe('string');
    expect(data.metric.formatted).toMatch(/^\$/);
    expect(data.trend).toBeDefined();
    expect(Array.isArray(data.breakdown)).toBe(true);
    expect(data.breakdown!.length).toBeGreaterThan(0);
    expect(Array.isArray(data.chartData)).toBe(true);
    expect(data.chartData!.length).toBe(30);
  });

  it('breakdown values sum roughly to current metric', () => {
    const data = mockWidgetData.revenue();
    const sum = data.breakdown!.reduce((acc, b) => acc + b.value, 0);
    // Allow floating point tolerance
    expect(Math.abs(sum - data.metric.current)).toBeLessThan(10);
  });

  it('chart data has ISO date strings', () => {
    const data = mockWidgetData.revenue();
    data.chartData!.forEach((point) => {
      expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(point.value).toBeGreaterThan(0);
    });
  });
});

describe('mockWidgetData.orders', () => {
  it('returns a valid OrdersWidgetData shape', () => {
    const data = mockWidgetData.orders();
    expect(typeof data.metric.current).toBe('number');
    expect(typeof data.pendingCount).toBe('number');
    expect(typeof data.processingCount).toBe('number');
    expect(typeof data.completedCount).toBe('number');
  });

  it('sub-counts sum to total', () => {
    const data = mockWidgetData.orders();
    const total = data.pendingCount + data.processingCount + data.completedCount;
    expect(total).toBe(data.metric.current);
  });
});

describe('mockWidgetData.inventory', () => {
  it('returns a valid InventoryWidgetData shape', () => {
    const data = mockWidgetData.inventory();
    expect(typeof data.metric.current).toBe('number');
    expect(typeof data.lowStockCount).toBe('number');
    expect(typeof data.outOfStockCount).toBe('number');
    expect(typeof data.totalSkus).toBe('number');
    expect(data.totalSkus).toBe(data.metric.current);
  });
});

describe('mockWidgetData.mrr', () => {
  it('returns MRR with ARR ~12x MRR', () => {
    const data = mockWidgetData.mrr();
    expect(data.metric.current).toBeGreaterThan(0);
    expect(data.arr).toBeDefined();
    // ARR should be 12x MRR (approx)
    const ratio = data.arr!.current / data.metric.current;
    expect(ratio).toBeCloseTo(12, 0);
  });

  it('has expansion and contraction values', () => {
    const data = mockWidgetData.mrr();
    expect(data.expansion?.current).toBeGreaterThan(0);
    expect(data.contraction?.current).toBeGreaterThan(0);
  });
});

describe('mockWidgetData.churn', () => {
  it('returns churn rate and retention that sum to 100', () => {
    const data = mockWidgetData.churn();
    expect(data.rate + data.retentionRate).toBeCloseTo(100, 5);
  });

  it('metric formatted value contains %', () => {
    const data = mockWidgetData.churn();
    expect(data.metric.formatted).toContain('%');
  });
});

describe('mockWidgetData.signups', () => {
  it('returns signups with daily average and weekly total', () => {
    const data = mockWidgetData.signups();
    expect(data.metric.current).toBeGreaterThan(0);
    expect(data.dailyAverage).toBeGreaterThan(0);
    expect(data.weeklyTotal).toBeGreaterThan(0);
  });

  it('daily average is roughly monthly / 30', () => {
    const data = mockWidgetData.signups();
    expect(Math.abs(data.dailyAverage - data.metric.current / 30)).toBeLessThan(1);
  });
});

describe('mockWidgetData.activity', () => {
  it('returns at least 1 activity item', () => {
    const data = mockWidgetData.activity();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBeGreaterThan(0);
  });

  it('each item has required fields', () => {
    const data = mockWidgetData.activity();
    data.items.forEach((item) => {
      expect(typeof item.id).toBe('string');
      expect(typeof item.message).toBe('string');
      expect(typeof item.time).toBe('string');
      expect(['order', 'invoice', 'agent', 'contact', 'inventory', 'system']).toContain(item.type);
    });
  });
});

describe('mockWidgetData.chart', () => {
  it('returns 30 data points', () => {
    const data = mockWidgetData.chart();
    expect(data.points).toHaveLength(30);
  });

  it('data points have ISO dates in ascending order', () => {
    const data = mockWidgetData.chart();
    for (let i = 1; i < data.points.length; i++) {
      const prev = data.points[i - 1]!.date;
      const curr = data.points[i]!.date;
      expect(curr >= prev).toBe(true);
    }
  });
});
