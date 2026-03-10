'use client';

import { UserRole } from '@unicore/shared-types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@unicore/ui';
import { useState } from 'react';

import { useWizardState } from '@/hooks/use-wizard-state';
import type { TeamMember } from '@/types/wizard';

const ROLE_OPTIONS = [
  { value: UserRole.Owner, label: 'Owner' },
  { value: UserRole.Operator, label: 'Operator' },
  { value: UserRole.Marketer, label: 'Marketer' },
  { value: UserRole.Finance, label: 'Finance' },
  { value: UserRole.Viewer, label: 'Viewer' },
];

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-800',
  operator: 'bg-blue-100 text-blue-800',
  marketer: 'bg-green-100 text-green-800',
  finance: 'bg-amber-100 text-amber-800',
  viewer: 'bg-gray-100 text-gray-800',
};

export function StepTeam() {
  const { state, dispatch } = useWizardState();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.Viewer);
  const [error, setError] = useState('');

  function handleAdd() {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Invalid email address');
      return;
    }
    if (state.team.some((m) => m.email === trimmed)) {
      setError('This email is already added');
      return;
    }
    setError('');
    dispatch({ type: 'ADD_TEAM_MEMBER', member: { email: trimmed, role } });
    setEmail('');
    setRole(UserRole.Viewer);
  }

  function handleRemove(index: number) {
    dispatch({ type: 'REMOVE_TEAM_MEMBER', index });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Team & Roles</h2>
        <p className="text-muted-foreground mt-1">
          Invite team members and assign their roles. You can skip this and add them later.
        </p>
      </div>

      {/* Add Member Form */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="member-email">Email</Label>
              <Input
                id="member-email"
                type="email"
                placeholder="team@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div className="w-full sm:w-40 space-y-1">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleAdd} size="default">Add</Button>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {/* Team Member List */}
      {state.team.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Team Members ({state.team.length})
          </Label>
          <div className="space-y-2">
            {state.team.map((member, i) => (
              <div
                key={member.email}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{member.email}</span>
                  <Badge className={ROLE_COLORS[member.role]} variant="secondary">
                    {member.role}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(i)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {state.team.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          No team members added yet. You can add them later from the dashboard.
        </p>
      )}
    </div>
  );
}
