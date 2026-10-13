import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiConflictResponse, ApiCookieAuth, ApiCreatedResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { assertCsrf } from '../auth/csrf';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@ApiCookieAuth('sessionCookie')
@Controller('orders')
export class OrdersController {
  constructor(private readonly auth: AuthService, private readonly orders: OrdersService) {}

  @ApiOperation({ summary: 'Checkout the current cart with COD' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'One UUID per checkout attempt' })
  @ApiCreatedResponse({ description: 'Created order, or prior result for the same idempotency key and payload' })
  @ApiBadRequestResponse({ description: 'Invalid payload or empty cart' })
  @ApiConflictResponse({ description: 'Stock changed or idempotency key has another payload' })
  @Post()
  async checkout(@Body() body: Record<string, unknown>, @Headers('idempotency-key') key: string | undefined, @Headers('cookie') cookie: string | undefined, @Headers('x-csrf-token') csrfToken: string | undefined, @Headers('origin') origin: string | undefined) {
    assertCsrf(cookie, csrfToken, origin);
    return this.orders.checkout((await this.auth.me(cookie)).id, key, body);
  }

  @ApiOperation({ summary: 'List my orders' }) @ApiOkResponse({ description: 'Orders owned by the current user' }) @ApiUnauthorizedResponse({ description: 'Session required' })
  @Get('me') async list(@Headers('cookie') cookie?: string) { return this.orders.list((await this.auth.me(cookie)).id); }

  @ApiOperation({ summary: 'Get one of my orders' }) @ApiParam({ name: 'id', format: 'uuid' }) @ApiOkResponse({ description: 'Owned order' }) @ApiNotFoundResponse({ description: 'Order not found' })
  @Get(':id') async get(@Param('id') id: string, @Headers('cookie') cookie?: string) { return this.orders.get((await this.auth.me(cookie)).id, id); }

  @ApiOperation({ summary: 'Cancel my pending order and restore stock once' }) @ApiParam({ name: 'id', format: 'uuid' }) @ApiOkResponse({ description: 'Cancelled order' }) @ApiConflictResponse({ description: 'Only pending orders can be cancelled' })
  @Post(':id/cancel') async cancel(@Param('id') id: string, @Headers('cookie') cookie: string | undefined, @Headers('x-csrf-token') csrfToken: string | undefined, @Headers('origin') origin: string | undefined) {
    assertCsrf(cookie, csrfToken, origin);
    return this.orders.cancel((await this.auth.me(cookie)).id, id);
  }
}
