import { ForbiddenException } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'node:crypto';

export const CSRF_COOKIE_NAME = 'bookstore_csrf';

export function createCsrfToken() {
  return randomBytes(32).toString('base64url');
}

export function readCookie(cookieHeader: string | undefined, name: string) {
  return cookieHeader?.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

export function assertCsrf(cookieHeader: string | undefined, headerToken: string | undefined, origin: string | undefined) {
  const cookieToken = readCookie(cookieHeader, CSRF_COOKIE_NAME);
  const allowedOrigin = process.env.CORS_ORIGIN;
  if (origin && allowedOrigin && origin !== allowedOrigin) throw new ForbiddenException('Cross-site request rejected');
  if (!cookieToken || !headerToken || cookieToken.length !== headerToken.length || !timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
    throw new ForbiddenException('CSRF validation failed');
  }
}
