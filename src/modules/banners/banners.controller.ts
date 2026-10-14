import { Body, Controller, ForbiddenException, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiCookieAuth, ApiCreatedResponse, ApiForbiddenResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { assertCsrf } from '../auth/csrf';
import { BannersService } from './banners.service';

@ApiTags('Banners')
@Controller('banners')
export class BannersController {
  constructor(private readonly banners: BannersService) {}
  @ApiOperation({ summary: 'List active homepage banners' }) @ApiOkResponse({ description: 'Active banners ordered for storefront carousel' })
  @Get() list() { return this.banners.listPublic(); }
}

@ApiTags('Admin')
@ApiCookieAuth('sessionCookie')
@Controller('admin/banners')
export class AdminBannersController {
  constructor(private readonly auth: AuthService, private readonly banners: BannersService) {}
  private async requireAdmin(cookie?: string) { const user = await this.auth.me(cookie); if (user.role !== 'ADMIN') throw new ForbiddenException('Administrator access required'); }
  @ApiOperation({ summary: 'List all homepage banners as ADMIN' }) @ApiOkResponse({ description: 'Active and inactive banners' }) @ApiUnauthorizedResponse({ description: 'Session required' }) @ApiForbiddenResponse({ description: 'ADMIN role required' })
  @Get() async list(@Headers('cookie') cookie?: string) { await this.requireAdmin(cookie); return this.banners.listAdmin(); }
  @ApiOperation({ summary: 'Create a homepage banner as ADMIN' }) @ApiHeader({ name: 'X-CSRF-Token', required: true }) @ApiCreatedResponse({ description: 'Banner created' }) @ApiBadRequestResponse({ description: 'Invalid banner payload or CSRF token' })
  @Post() async create(@Body() body: Record<string, unknown>, @Headers('cookie') cookie: string | undefined, @Headers('x-csrf-token') csrf: string | undefined, @Headers('origin') origin: string | undefined) { assertCsrf(cookie, csrf, origin); await this.requireAdmin(cookie); return this.banners.create(body); }
  @ApiOperation({ summary: 'Edit, activate/deactivate, or reorder a homepage banner as ADMIN' }) @ApiParam({ name: 'id', format: 'uuid' }) @ApiHeader({ name: 'X-CSRF-Token', required: true }) @ApiOkResponse({ description: 'Banner updated' }) @ApiBadRequestResponse({ description: 'Invalid banner payload or CSRF token' }) @ApiNotFoundResponse({ description: 'Banner not found' })
  @Patch(':id') async update(@Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('cookie') cookie: string | undefined, @Headers('x-csrf-token') csrf: string | undefined, @Headers('origin') origin: string | undefined) { assertCsrf(cookie, csrf, origin); await this.requireAdmin(cookie); return this.banners.update(id, body); }
}
