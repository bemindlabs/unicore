// User & Auth Types

export enum UserRole {
  Owner = 'owner',
  Operator = 'operator',
  Marketer = 'marketer',
  Finance = 'finance',
  Viewer = 'viewer',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}