import { Body, Controller, ForbiddenException, Get, Headers, Param, Patch, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiConflictResponse, ApiCookieAuth, ApiForbiddenResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { assertCsrf } from '../auth/csrf';
import { OrdersService } from './orders.service';

@ApiTags('Admin')
@ApiCookieAuth('sessionCookie')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly auth: AuthService, private readonly orders: OrdersService) {}
  private async requireAdmin(cookie?: string) { const user = await this.auth.me(cookie); if (user.role !== 'ADMIN') throw new ForbiddenException('Administrator access required'); return user; }
  @ApiOperation({ summary: 'List orders as ADMIN with customer-safe details and status history' }) @ApiQuery({ name: 'page', required: false, type: Number }) @ApiQuery({ name: 'limit', required: false, type: Number }) @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'CONFIRMED', 'PACKING', 'SHIPPING', 'DELIVERED', 'CANCELED'] }) @ApiQuery({ name: 'q', required: false, type: String }) @ApiOkResponse({ description: 'Paginated orders' }) @ApiUnauthorizedResponse({ description: 'Session required' }) @ApiForbiddenResponse({ description: 'ADMIN role required' })
  @Get() async list(@Query('page') page: string | undefined, @Query('limit') limit: string | undefined, @Query('status') status: string | undefined, @Query('q') q: string | undefined, @Headers('cookie') cookie?: string) { await this.requireAdmin(cookie); return this.orders.adminList(page, limit, status, q); }
  @ApiOperation({ summary: 'Apply a valid ADMIN order status transition' }) @ApiParam({ name: 'id', format: 'uuid' }) @ApiHeader({ name: 'X-CSRF-Token', required: true }) @ApiOkResponse({ description: 'Order after valid transition' }) @ApiBadRequestResponse({ description: 'Invalid status payload or CSRF token' }) @ApiConflictResponse({ description: 'Invalid or stale status transition' }) @ApiNotFoundResponse({ description: 'Order not found' })
  @Patch(':id/status') async transition(@Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('cookie') cookie: string | undefined, @Headers('x-csrf-token') csrf: string | undefined, @Headers('origin') origin: string | undefined) { assertCsrf(cookie, csrf, origin); const user = await this.requireAdmin(cookie); return this.orders.adminTransition(user.id, id, body); }
}
