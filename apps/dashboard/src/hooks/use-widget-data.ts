'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { widgetDataFetchers, mockWidgetData } from '@/lib/widget-data';
import type { WidgetData, WidgetType } from '@/types/widget';

type FetcherKey = keyof typeof widgetDataFetchers;

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || process.env.NODE_ENV === 'development';

/**
 * Generic hook that fetches data for any widget type.
 * Falls back to mock data when the API is unavailable or in development mode.
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
      let result: T;

      if (USE_MOCK) {
        // Simulate slight network delay in mock mode
        await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));
        const mockFn = mockWidgetData[type as keyof typeof mockWidgetData];
        if (!mockFn) throw new Error(`No mock data for widget type: ${type}`);
        result = (mockFn as () => T)();
      } else {
        const fetcher = widgetDataFetchers[type as FetcherKey];
        if (!fetcher) throw new Error(`No fetcher for widget type: ${type}`);
        result = (await (fetcher as (o: Record<string, unknown>) => Promise<T>)(options ?? {})) as T;
      }

      if (mountedRef.current) {
        setData(result);
        setLastUpdated(new Date());
      }
    } catch (err) {
      if (!mountedRef.current) return;

      // On API failure, fall back to mock data silently
      const mockFn = mockWidgetData[type as keyof typeof mockWidgetData];
      if (mockFn) {
        setData((mockFn as () => T)());
        setLastUpdated(new Date());
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch widget data');
      }
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
  return useWidgetData<ReturnType<typeof mockWidgetData.revenue>>('revenue', undefined, refreshInterval);
}

export function useOrdersData(refreshInterval?: number) {
  return useWidgetData<ReturnType<typeof mockWidgetData.orders>>('orders', undefined, refreshInterval);
}

export function useInventoryData(refreshInterval?: number) {
  return useWidgetData<ReturnType<typeof mockWidgetData.inventory>>('inventory', undefined, refreshInterval);
}

export function useMrrData(refreshInterval?: number) {
  return useWidgetData<ReturnType<typeof mockWidgetData.mrr>>('mrr', undefined, refreshInterval);
}

export function useChurnData(refreshInterval?: number) {
  return useWidgetData<ReturnType<typeof mockWidgetData.churn>>('churn', undefined, refreshInterval);
}

export function useSignupsData(refreshInterval?: number) {
  return useWidgetData<ReturnType<typeof mockWidgetData.signups>>('signups', undefined, refreshInterval);
}

export function useActivityData(refreshInterval?: number) {
  return useWidgetData<ReturnType<typeof mockWidgetData.activity>>('activity', undefined, refreshInterval);
}

export function useChartData(options?: Record<string, unknown>, refreshInterval?: number) {
  return useWidgetData<ReturnType<typeof mockWidgetData.chart>>('chart', options, refreshInterval);
}
