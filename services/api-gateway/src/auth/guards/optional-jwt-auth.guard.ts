import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Attempts JWT authentication but does NOT reject the request when no token
 * is present. If a valid Bearer token is supplied, `req.user` is populated
 * as usual; otherwise the request continues with `req.user = undefined`.
 *
 * Use this on routes that accept *either* JWT auth or an alternative
 * authentication mechanism (e.g. X-Platform-Secret).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(
    _err: any,
    user: TUser | false,
    _info: any,
    _context: ExecutionContext,
  ): TUser | undefined {
    // If passport resolved a user, return it; otherwise let the request through.
    return user || undefined;
  }
}
