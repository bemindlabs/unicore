/**
 * Tests for the default dashboard configuration structure.
 */

import { DEFAULT_DASHBOARD_CONFIG } from '../config/default-dashboard';

describe('DEFAULT_DASHBOARD_CONFIG', () => {
  it('has a widgets array', () => {
    expect(Array.isArray(DEFAULT_DASHBOARD_CONFIG.widgets)).toBe(true);
    expect(DEFAULT_DASHBOARD_CONFIG.widgets.length).toBeGreaterThan(0);
  });

  it('every widget has a unique id', () => {
    const ids = DEFAULT_DASHBOARD_CONFIG.widgets.map((w) => w.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('every widget has required fields', () => {
    DEFAULT_DASHBOARD_CONFIG.widgets.forEach((widget) => {
      expect(typeof widget.id).toBe('string');
      expect(typeof widget.type).toBe('string');
      expect(typeof widget.title).toBe('string');
      expect(typeof widget.enabled).toBe('boolean');
    });
  });

  it('includes all expected widget types', () => {
    const types = DEFAULT_DASHBOARD_CONFIG.widgets.map((w) => w.type);
    const expectedTypes = ['revenue', 'orders', 'mrr', 'signups', 'inventory', 'churn', 'chart', 'activity'];
    expectedTypes.forEach((expectedType) => {
      expect(types).toContain(expectedType);
    });
  });

  it('has at least one stats widget and one wide widget', () => {
    const statsWidgets = DEFAULT_DASHBOARD_CONFIG.widgets.filter(
      (w) => w.enabled && !['chart', 'activity'].includes(w.type),
    );
    const wideWidgets = DEFAULT_DASHBOARD_CONFIG.widgets.filter(
      (w) => w.enabled && ['chart', 'activity'].includes(w.type),
    );
    expect(statsWidgets.length).toBeGreaterThan(0);
    expect(wideWidgets.length).toBeGreaterThan(0);
  });

  it('refreshInterval is positive when set', () => {
    DEFAULT_DASHBOARD_CONFIG.widgets.forEach((widget) => {
      if (widget.refreshInterval !== undefined) {
        expect(widget.refreshInterval).toBeGreaterThan(0);
      }
    });
  });
});
