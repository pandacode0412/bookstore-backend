import { Body, Controller, Get, Headers, HttpCode, Post, Res } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBody, ApiConflictResponse, ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiUnauthorizedResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { assertCsrf, createCsrfToken, CSRF_COOKIE_NAME } from './csrf';

const cookieOptions = (maxAge?: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api',
  ...(maxAge === undefined ? {} : { maxAge }),
});

const csrfCookieOptions = (maxAge?: number) => ({
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  ...(maxAge === undefined ? {} : { maxAge }),
});

function issueSessionCookies(response: Response, session: { token: string; expiresAt: Date }) {
  const maxAge = session.expiresAt.getTime() - Date.now();
  // Clear the old development CSRF cookie at /api before issuing the readable root cookie.
  response.clearCookie(CSRF_COOKIE_NAME, { ...cookieOptions(), httpOnly: false });
  response.cookie('bookstore_session', session.token, cookieOptions(maxAge));
  response.cookie(CSRF_COOKIE_NAME, createCsrfToken(), csrfCookieOptions(maxAge));
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @ApiOperation({ summary: 'Register a customer account and issue an HttpOnly session cookie' })
  @ApiBody({ schema: { required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 6 }, fullName: { type: 'string', maxLength: 120 } } } })
  @ApiCreatedResponse({ description: 'Customer account created; response sets bookstore_session cookie' })
  @ApiBadRequestResponse({ description: 'Invalid email, password, or full name' })
  @ApiConflictResponse({ description: 'Email is already registered' })
  @Post('register')
  async register(@Body() body: Record<string, unknown>, @Res({ passthrough: true }) response: Response) {
    const session = await this.auth.register(body);
    issueSessionCookies(response, session);
    return session.user;
  }

  @ApiOperation({ summary: 'Log in and issue an HttpOnly session cookie' })
  @ApiBody({ schema: { required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } } } })
  @ApiOkResponse({ description: 'Authenticated user; response sets bookstore_session cookie' })
  @ApiBadRequestResponse({ description: 'Invalid payload' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @HttpCode(200)
  @Post('login')
  async login(@Body() body: Record<string, unknown>, @Res({ passthrough: true }) response: Response) {
    const session = await this.auth.login(body);
    issueSessionCookies(response, session);
    return session.user;
  }

  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiCookieAuth('sessionCookie')
  @ApiOkResponse({ description: 'Current user' })
  @ApiUnauthorizedResponse({ description: 'Session missing, expired, or invalid' })
  @Get('me')
  me(@Headers('cookie') cookie?: string) {
    return this.auth.me(cookie);
  }

  @ApiOperation({ summary: 'Invalidate the current session' })
  @ApiCookieAuth('sessionCookie')
  @ApiUnauthorizedResponse({ description: 'Session missing, expired, or invalid' })
  @HttpCode(204)
  @Post('logout')
  async logout(@Headers('cookie') cookie: string | undefined, @Headers('x-csrf-token') csrfToken: string | undefined, @Headers('origin') origin: string | undefined, @Res({ passthrough: true }) response: Response) {
    assertCsrf(cookie, csrfToken, origin);
    await this.auth.logout(cookie);
    response.clearCookie('bookstore_session', cookieOptions());
    response.clearCookie(CSRF_COOKIE_NAME, csrfCookieOptions());
    response.clearCookie(CSRF_COOKIE_NAME, { ...cookieOptions(), httpOnly: false });
  }
}
