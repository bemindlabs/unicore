'use client';

import { useCallback, useState } from 'react';
import {
  MoreHorizontal,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from '@unicore/ui';
import { UserRole } from '@unicore/shared-types';
import { Breadcrumb } from '@/components/layout/breadcrumb';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  joinedAt: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.Owner]: 'Owner',
  [UserRole.Operator]: 'Operator',
  [UserRole.Marketer]: 'Marketer',
  [UserRole.Finance]: 'Finance',
  [UserRole.Viewer]: 'Viewer',
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  [UserRole.Owner]: 'Full access — billing, all modules, system config',
  [UserRole.Operator]: 'Dashboard, ERP, Workflows — day-to-day operations',
  [UserRole.Marketer]: 'Dashboard, Growth Agent, Comms Agent — campaigns and outreach',
  [UserRole.Finance]: 'Invoicing, Expenses, Reports — financial modules',
  [UserRole.Viewer]: 'Read-only access to Dashboard and Reports',
};

const ROLE_BADGE_VARIANT: Record<UserRole, 'default' | 'secondary' | 'outline'> = {
  [UserRole.Owner]: 'default',
  [UserRole.Operator]: 'secondary',
  [UserRole.Marketer]: 'secondary',
  [UserRole.Finance]: 'secondary',
  [UserRole.Viewer]: 'outline',
};

const MOCK_MEMBERS: TeamMember[] = [
  {
    id: '1',
    name: 'Alice Chen',
    email: 'alice@example.com',
    role: UserRole.Owner,
    joinedAt: '2024-01-01',
  },
  {
    id: '2',
    name: 'Bob Smith',
    email: 'bob@example.com',
    role: UserRole.Operator,
    joinedAt: '2024-02-15',
  },
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function SettingsTeamPage() {
  const [members, setMembers] = useState<TeamMember[]>(MOCK_MEMBERS);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>(UserRole.Operator);
  const [isInviting, setIsInviting] = useState(false);

  const handleInvite = useCallback(async () => {
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      // TODO: api.post('/settings/team/invite', { email: inviteEmail, role: inviteRole })
      await new Promise((r) => setTimeout(r, 600));
      const newMember: TeamMember = {
        id: String(Date.now()),
        name: inviteEmail.split('@')[0] ?? inviteEmail,
        email: inviteEmail,
        role: inviteRole,
        joinedAt: new Date().toISOString().slice(0, 10),
      };
      setMembers((prev) => [...prev, newMember]);
      toast({ title: 'Invitation sent', description: `Invite sent to ${inviteEmail}` });
      setInviteEmail('');
      setInviteOpen(false);
    } finally {
      setIsInviting(false);
    }
  }, [inviteEmail, inviteRole]);

  const handleChangeRole = useCallback((id: string, role: UserRole) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)));
    toast({ title: 'Role updated' });
  }, []);

  const handleRemove = useCallback((id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    toast({ title: 'Member removed' });
  }, []);

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* Role reference card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Roles & Permissions</CardTitle>
          </div>
          <CardDescription>UniCore supports up to 5 team members (Community Edition).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.values(UserRole) as UserRole[]).map((role) => (
              <div
                key={role}
                className="flex flex-col gap-1 rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{ROLE_LABELS[role]}</span>
                </div>
                <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Members table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>Team Members</CardTitle>
            </div>
            <CardDescription>{members.length} member{members.length !== 1 ? 's' : ''}</CardDescription>
          </div>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Invite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Send an invitation email. The recipient will set their own password on first login.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email Address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(v) => setInviteRole(v as UserRole)}
                  >
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.values(UserRole) as UserRole[])
                        .filter((r) => r !== UserRole.Owner)
                        .map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInvite} disabled={isInviting || !inviteEmail.trim()}>
                  {isInviting ? 'Sending…' : 'Send Invite'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ROLE_BADGE_VARIANT[member.role]}>
                      {ROLE_LABELS[member.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {member.joinedAt}
                  </TableCell>
                  <TableCell>
                    {member.role !== UserRole.Owner && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(Object.values(UserRole) as UserRole[])
                            .filter((r) => r !== UserRole.Owner && r !== member.role)
                            .map((role) => (
                              <DropdownMenuItem
                                key={role}
                                onClick={() => handleChangeRole(member.id, role)}
                              >
                                Change to {ROLE_LABELS[role]}
                              </DropdownMenuItem>
                            ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleRemove(member.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
