import { Card, CardContent, CardHeader, CardTitle } from '@unicore/ui';

interface ChartWidgetProps {
  title: string;
}

export function ChartWidget({ title }: ChartWidgetProps) {
  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Chart placeholder
        </div>
      </CardContent>
    </Card>
  );
}
