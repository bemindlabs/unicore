// Shared loading skeleton used by all stat-style widgets

import { Card, CardContent, CardHeader, Skeleton } from '@unicore/ui';

export function WidgetSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="mb-2 h-8 w-24" />
        <Skeleton className="h-3 w-40" />
      </CardContent>
    </Card>
  );
}

export function WidgetErrorCard({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="flex h-full min-h-[100px] items-center justify-center">
        <p className="text-sm text-destructive">{message}</p>
      </CardContent>
    </Card>
  );
}
