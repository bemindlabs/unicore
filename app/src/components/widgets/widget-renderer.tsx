'use client';

import { resolveWidget } from './widget-registry';
import { WidgetErrorCard } from './widget-skeleton';
import type { WidgetConfig } from '@/types/widget';

interface WidgetRendererProps {
  config: WidgetConfig;
}

/**
 * Renders a single widget by looking it up in the registry.
 * Unknown types render a clear error state rather than crashing.
 */
export function WidgetRenderer({ config }: WidgetRendererProps): JSX.Element {
  const Widget = resolveWidget(config.type);

  if (!Widget) {
    return <WidgetErrorCard message={`Unknown widget type: "${config.type}"`} />;
  }

  return <Widget config={config} />;
}
