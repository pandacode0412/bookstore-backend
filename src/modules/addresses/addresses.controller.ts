import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { assertCsrf } from '../auth/csrf';
import { AddressesService } from './addresses.service';

@ApiTags('Addresses')
@ApiCookieAuth('sessionCookie')
@Controller('addresses')
export class AddressesController {
  constructor(private readonly auth: AuthService, private readonly addresses: AddressesService) {}

  @ApiOperation({ summary: 'List my saved delivery addresses' })
  @ApiOkResponse({ description: 'Addresses owned by the current user' })
  @ApiUnauthorizedResponse({ description: 'Session required' })
  @Get()
  async list(@Headers('cookie') cookie?: string) { return this.addresses.list((await this.auth.me(cookie)).id); }

  @ApiOperation({ summary: 'Save a delivery address' })
  @ApiBody({ schema: { required: ['recipientName', 'phone', 'line1', 'city'], properties: { recipientName: { type: 'string', maxLength: 120 }, phone: { type: 'string', maxLength: 25 }, line1: { type: 'string', maxLength: 255 }, ward: { type: 'string', nullable: true }, district: { type: 'string', nullable: true }, city: { type: 'string', maxLength: 120 }, isDefault: { type: 'boolean' } } } })
  @ApiCreatedResponse({ description: 'Saved address' })
  @Post()
  async create(@Body() body: Record<string, unknown>, @Headers('cookie') cookie: string | undefined, @Headers('x-csrf-token') csrfToken: string | undefined, @Headers('origin') origin: string | undefined) {
    assertCsrf(cookie, csrfToken, origin);
    return this.addresses.create((await this.auth.me(cookie)).id, body);
  }
}
