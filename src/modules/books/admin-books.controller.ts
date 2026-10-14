import { Body, Controller, ForbiddenException, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiConflictResponse, ApiCookieAuth, ApiCreatedResponse, ApiForbiddenResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { assertCsrf } from '../auth/csrf';
import { BooksService } from './books.service';

@ApiTags('Admin')
@ApiCookieAuth('sessionCookie')
@Controller('admin/books')
export class AdminBooksController {
  constructor(private readonly auth: AuthService, private readonly books: BooksService) {}
  private async requireAdmin(cookie?: string) {
    const user = await this.auth.me(cookie);
    if (user.role !== 'ADMIN') throw new ForbiddenException('Administrator access required');
    return user;
  }

  @ApiOperation({ summary: 'List all books as ADMIN, including drafts and archived books' })
  @ApiQuery({ name: 'page', required: false, type: Number }) @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, type: String }) @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] })
  @ApiOkResponse({ description: 'Paginated administrative book list' }) @ApiUnauthorizedResponse({ description: 'Session required' }) @ApiForbiddenResponse({ description: 'ADMIN role required' })
  @Get()
  async list(@Query('page') page: string | undefined, @Query('limit') limit: string | undefined, @Query('q') q: string | undefined, @Query('status') status: string | undefined, @Headers('cookie') cookie?: string) {
    await this.requireAdmin(cookie);
    return this.books.adminList(page, limit, q, status);
  }

  @ApiOperation({ summary: 'Create a book as ADMIN' }) @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiCreatedResponse({ description: 'Book created' }) @ApiBadRequestResponse({ description: 'Invalid book payload or CSRF token' }) @ApiConflictResponse({ description: 'SKU, slug, or ISBN already exists' })
  @Post()
  async create(@Body() body: Record<string, unknown>, @Headers('cookie') cookie: string | undefined, @Headers('x-csrf-token') csrf: string | undefined, @Headers('origin') origin: string | undefined) {
    assertCsrf(cookie, csrf, origin); await this.requireAdmin(cookie); return this.books.adminCreate(body);
  }

  @ApiOperation({ summary: 'Edit a book, images, author list, stock, pricing, or publication status as ADMIN' }) @ApiParam({ name: 'id', format: 'uuid' }) @ApiHeader({ name: 'X-CSRF-Token', required: true })
  @ApiOkResponse({ description: 'Book updated' }) @ApiBadRequestResponse({ description: 'Invalid book payload or CSRF token' }) @ApiConflictResponse({ description: 'SKU, slug, or ISBN already exists' }) @ApiNotFoundResponse({ description: 'Book not found' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('cookie') cookie: string | undefined, @Headers('x-csrf-token') csrf: string | undefined, @Headers('origin') origin: string | undefined) {
    assertCsrf(cookie, csrf, origin); const user = await this.requireAdmin(cookie); return this.books.adminUpdate(user.id, id, body);
  }
}
