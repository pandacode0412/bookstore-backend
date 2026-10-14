import { Body, Controller, ForbiddenException, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBody, ApiConflictResponse, ApiCookieAuth, ApiCreatedResponse, ApiForbiddenResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { assertCsrf } from '../auth/csrf';
import { CategoriesService } from './categories.service';

const categoryBody = {
  type: 'object', properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    slug: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', maxLength: 100 },
    description: { type: 'string', maxLength: 500, nullable: true },
    isActive: { type: 'boolean' },
    sortOrder: { type: 'integer', minimum: 0, maximum: 1000000 },
  },
};

@ApiTags('Admin')
@ApiCookieAuth('sessionCookie')
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly auth: AuthService, private readonly categories: CategoriesService) {}

  private async requireAdmin(cookie?: string) {
    const user = await this.auth.me(cookie);
    if (user.role !== 'ADMIN') throw new ForbiddenException('Administrator access required');
  }

  @ApiOperation({ summary: 'List all categories as ADMIN, including inactive categories' })
  @ApiOkResponse({ description: 'Categories sorted by sortOrder then name' })
  @ApiUnauthorizedResponse({ description: 'Session required' })
  @ApiForbiddenResponse({ description: 'ADMIN role required' })
  @Get()
  async list(@Headers('cookie') cookie?: string) {
    await this.requireAdmin(cookie);
    return this.categories.listAdmin();
  }

  @ApiOperation({ summary: 'Create a category as ADMIN' })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, description: 'Value of the readable bookstore_csrf cookie' })
  @ApiBody({ schema: { ...categoryBody, required: ['name', 'slug'] } })
  @ApiCreatedResponse({ description: 'Category created' })
  @ApiBadRequestResponse({ description: 'Invalid category payload or CSRF token' })
  @ApiConflictResponse({ description: 'Category slug already exists' })
  @Post()
  async create(@Body() body: Record<string, unknown>, @Headers('cookie') cookie: string | undefined, @Headers('x-csrf-token') csrfToken: string | undefined, @Headers('origin') origin: string | undefined) {
    assertCsrf(cookie, csrfToken, origin);
    await this.requireAdmin(cookie);
    return this.categories.create(body);
  }

  @ApiOperation({ summary: 'Edit, activate/deactivate, or reorder a category as ADMIN' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiHeader({ name: 'X-CSRF-Token', required: true, description: 'Value of the readable bookstore_csrf cookie' })
  @ApiBody({ schema: categoryBody })
  @ApiOkResponse({ description: 'Updated category' })
  @ApiBadRequestResponse({ description: 'Invalid category id, payload, or CSRF token' })
  @ApiConflictResponse({ description: 'Category slug already exists' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('cookie') cookie: string | undefined, @Headers('x-csrf-token') csrfToken: string | undefined, @Headers('origin') origin: string | undefined) {
    assertCsrf(cookie, csrfToken, origin);
    await this.requireAdmin(cookie);
    return this.categories.update(id, body);
  }
}
