// Widget registry — maps WidgetType to the concrete component

import type { ComponentType } from 'react';
import type { WidgetConfig } from '@/types/widget';
import { RevenueWidget } from './revenue-widget';
import { OrdersWidget } from './orders-widget';
import { InventoryWidget } from './inventory-widget';
import { MrrWidget } from './mrr-widget';
import { ChurnWidget } from './churn-widget';
import { SignupsWidget } from './signups-widget';
import { ActivityWidget } from './activity-widget';
import { ChartWidget } from './chart-widget';

export type WidgetComponentProps = {
  config: WidgetConfig;
};

type WidgetComponentMap = Record<string, ComponentType<WidgetComponentProps>>;

export const widgetRegistry: WidgetComponentMap = {
  revenue: RevenueWidget,
  orders: OrdersWidget,
  inventory: InventoryWidget,
  mrr: MrrWidget,
  churn: ChurnWidget,
  signups: SignupsWidget,
  activity: ActivityWidget,
  chart: ChartWidget,
};

/**
 * Resolves a registered widget component by type.
 * Returns null if the type is not registered.
 */
export function resolveWidget(type: string): ComponentType<WidgetComponentProps> | null {
  return widgetRegistry[type] ?? null;
}
