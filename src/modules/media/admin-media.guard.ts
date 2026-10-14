import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { assertCsrf } from '../auth/csrf';

function headerValue(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Guards the multipart endpoint before Multer reads a file into memory.
 * Other ADMIN controllers still use their existing JSON request pattern.
 */
@Injectable()
export class AdminMediaGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const cookie = headerValue(request.headers.cookie);
    assertCsrf(cookie, headerValue(request.headers['x-csrf-token']), headerValue(request.headers.origin));
    const user = await this.auth.me(cookie);
    if (user.role !== 'ADMIN') throw new ForbiddenException('Administrator access required');
    return true;
  }
}
