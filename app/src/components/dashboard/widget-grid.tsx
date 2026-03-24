'use client';

import type { ReactNode } from 'react';
import { useDashboardConfig } from '@/hooks/use-dashboard-config';
import { WidgetRenderer } from '@/components/widgets/widget-renderer';
import { Skeleton } from '@bemindlabs/unicore-ui';

// ─── Static layout variant (used for custom layouts defined in JSX) ───────────

interface StaticWidgetGridProps {
  children: ReactNode;
  columns?: number;
}

export function StaticWidgetGrid({ children, columns = 4 }: StaticWidgetGridProps) {
  const colClass =
    columns === 2
      ? 'sm:grid-cols-2'
      : columns === 3
        ? 'sm:grid-cols-2 lg:grid-cols-3'
        : 'sm:grid-cols-2 lg:grid-cols-4';

  return <div className={`grid gap-4 ${colClass}`}>{children}</div>;
}

// ─── Dynamic config-driven variant ────────────────────────────────────────────

/**
 * Renders a widget grid driven entirely by the DashboardConfig loaded from
 * unicore.config.json / the API.  Falls back to the default config when the
 * API is unreachable.
 */
export function DynamicWidgetGrid() {
  const { config, loading } = useDashboardConfig();

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const statsWidgets = config.widgets.filter(
    (w) => w.enabled && !['chart', 'activity'].includes(w.type),
  );
  const wideWidgets = config.widgets.filter(
    (w) => w.enabled && ['chart', 'activity'].includes(w.type),
  );

  return (
    <div className="space-y-4">
      {/* Stats row */}
      {statsWidgets.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statsWidgets.map((widgetConfig) => (
            <WidgetRenderer key={widgetConfig.id} config={widgetConfig} />
          ))}
        </div>
      )}

      {/* Wide widgets row (charts, activity feeds) */}
      {wideWidgets.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-4">
          {wideWidgets.map((widgetConfig) => (
            <WidgetRenderer key={widgetConfig.id} config={widgetConfig} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Legacy named export for backward compat ─────────────────────────────────

/** @deprecated Use DynamicWidgetGrid for config-driven layout */
export function WidgetGrid({ children }: { children: ReactNode }) {
  return <StaticWidgetGrid>{children}</StaticWidgetGrid>;
}
