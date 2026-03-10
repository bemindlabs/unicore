import { Card, CardContent, CardHeader, CardTitle } from '@unicore/ui';

const placeholderActivities = [
  { id: '1', message: 'New order #1042 received', time: '2 minutes ago' },
  { id: '2', message: 'Invoice #892 marked as paid', time: '15 minutes ago' },
  { id: '3', message: 'AI Agent completed lead qualification', time: '1 hour ago' },
  { id: '4', message: 'New contact added: Jane Smith', time: '2 hours ago' },
  { id: '5', message: 'Inventory alert: Widget A below threshold', time: '3 hours ago' },
];

export function ActivityWidget() {
  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {placeholderActivities.map((activity) => (
            <div key={activity.id} className="flex items-start justify-between gap-4 text-sm">
              <p className="text-foreground">{activity.message}</p>
              <span className="shrink-0 text-xs text-muted-foreground">{activity.time}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
