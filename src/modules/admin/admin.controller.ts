import { BadRequestException, Controller, ForbiddenException, Get, Headers, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@ApiCookieAuth('sessionCookie')
@Controller('admin')
export class AdminController {
  constructor(private readonly auth: AuthService, private readonly admin: AdminService) {}

  @ApiOperation({ summary: 'Get read-only dashboard metrics as ADMIN' })
  @ApiOkResponse({
    description: 'Book, order, low-stock and delivered-revenue metrics with the five most recent orders',
    schema: {
      type: 'object', required: ['metrics', 'orderStatus', 'recentOrders'], properties: {
        metrics: { type: 'object', properties: {
          totalBooks: { type: 'integer' }, publishedBooks: { type: 'integer' }, lowStockBooks: { type: 'integer' },
          totalOrders: { type: 'integer' }, pendingOrders: { type: 'integer' }, deliveredRevenueVnd: { type: 'integer' },
        } },
        orderStatus: { type: 'object', additionalProperties: { type: 'integer' } },
        recentOrders: { type: 'array', items: { type: 'object', properties: {
          id: { type: 'string', format: 'uuid' }, orderCode: { type: 'string' }, status: { type: 'string' },
          totalVnd: { type: 'integer' }, createdAt: { type: 'string', format: 'date-time' }, customerName: { type: 'string' }, itemCount: { type: 'integer' },
        } } },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Session required' })
  @ApiForbiddenResponse({ description: 'ADMIN role required' })
  @Get('dashboard')
  async dashboard(@Headers('cookie') cookie?: string) {
    const user = await this.auth.me(cookie);
    if (user.role !== 'ADMIN') throw new ForbiddenException('Administrator access required');
    return this.admin.dashboard();
  }

  @ApiOperation({ summary: 'List customers as ADMIN without credentials or session data' })
  @ApiQuery({ name: 'page', required: false, type: Number }) @ApiQuery({ name: 'limit', required: false, type: Number }) @ApiQuery({ name: 'q', required: false, type: String })
  @ApiOkResponse({ description: 'Paginated customer-safe records' }) @ApiUnauthorizedResponse({ description: 'Session required' }) @ApiForbiddenResponse({ description: 'ADMIN role required' })
  @Get('customers')
  async customers(@Query('page') page: string | undefined, @Query('limit') limit: string | undefined, @Query('q') q: string | undefined, @Headers('cookie') cookie?: string) {
    const user = await this.auth.me(cookie);
    if (user.role !== 'ADMIN') throw new ForbiddenException('Administrator access required');
    try { return await this.admin.customers(page, limit, q); } catch (error) {
      if (error instanceof Error && error.message === 'Invalid customer filters') throw new BadRequestException(error.message);
      throw error;
    }
  }
}
