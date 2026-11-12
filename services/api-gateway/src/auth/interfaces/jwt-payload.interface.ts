export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  /** Tenant id (SaaS phase 4.2). Present on all newly-issued tokens. */
  tid?: string;
  jti?: string;
  iat?: number;
  exp?: number;
}
