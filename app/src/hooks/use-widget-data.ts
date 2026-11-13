'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { widgetDataFetchers } from '@/lib/widget-data';
import type {
  WidgetData,
  WidgetType,
  RevenueWidgetData,
  OrdersWidgetData,
  InventoryWidgetData,
  MrrWidgetData,
  ChurnWidgetData,
  SignupsWidgetData,
  ActivityWidgetData,
  ChartWidgetData,
} from '@/types/widget';

type FetcherKey = keyof typeof widgetDataFetchers;

/**
 * Generic hook that fetches data for any widget type.
 * Calls the real API; a failure surfaces as `error` so the widget can say so.
 */
export function useWidgetData<T>(
  type: WidgetType,
  options?: Record<string, unknown>,
  refreshInterval?: number,
): WidgetData<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!mountedRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const fetcher = widgetDataFetchers[type as FetcherKey];
      if (!fetcher) throw new Error(`No fetcher for widget type: ${type}`);
      const result = (await (fetcher as (o: Record<string, unknown>) => Promise<T>)(options ?? {})) as T;

      if (mountedRef.current) {
        setData(result);
        setLastUpdated(new Date());
      }
    } catch (err) {
      if (!mountedRef.current) return;

      // No fabricated fallback: a widget that cannot reach the API must say so
      // rather than show invented numbers next to real ones.
      setData(null);
      setError(err instanceof Error ? err.message : 'Failed to fetch widget data');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [type, options]);

  useEffect(() => {
    mountedRef.current = true;
    void fetchData();

    if (refreshInterval && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        void fetchData();
      }, refreshInterval * 1000);
    }

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchData, refreshInterval]);

  return { data, loading, error, lastUpdated, refetch: fetchData };
}

// Typed convenience hooks for each widget type
export function useRevenueData(refreshInterval?: number) {
  return useWidgetData<RevenueWidgetData>('revenue', undefined, refreshInterval);
}

export function useOrdersData(refreshInterval?: number) {
  return useWidgetData<OrdersWidgetData>('orders', undefined, refreshInterval);
}

export function useInventoryData(refreshInterval?: number) {
  return useWidgetData<InventoryWidgetData>('inventory', undefined, refreshInterval);
}

export function useMrrData(refreshInterval?: number) {
  return useWidgetData<MrrWidgetData>('mrr', undefined, refreshInterval);
}

export function useChurnData(refreshInterval?: number) {
  return useWidgetData<ChurnWidgetData>('churn', undefined, refreshInterval);
}

export function useSignupsData(refreshInterval?: number) {
  return useWidgetData<SignupsWidgetData>('signups', undefined, refreshInterval);
}

export function useActivityData(refreshInterval?: number) {
  return useWidgetData<ActivityWidgetData>('activity', undefined, refreshInterval);
}

export function useChartData(options?: Record<string, unknown>, refreshInterval?: number) {
  return useWidgetData<ChartWidgetData>('chart', options, refreshInterval);
}
