'use client';

import { useEffect, useState } from 'react';
import { UsersRound } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@unicore/ui';
import { api } from '@/lib/api';

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

const ROLE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  OWNER: 'default',
  OPERATOR: 'secondary',
  MARKETER: 'outline',
  FINANCE: 'outline',
  VIEWER: 'outline',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<UserRecord[]>('/admin/users')
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UsersRound className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Users</h1>
            <p className="text-muted-foreground">
              Manage platform users and their roles
            </p>
          </div>
        </div>
        <Button>Invite User</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            All Users{' '}
            {!loading && (
              <span className="text-muted-foreground font-normal">
                ({users.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Loading users...
            </p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No users found. The admin users API endpoint may not be available
              yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const initials = u.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase();
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[10px]">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm">{u.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ROLE_VARIANT[u.role] ?? 'outline'}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
