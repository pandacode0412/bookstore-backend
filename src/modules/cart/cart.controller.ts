import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBody, ApiConflictResponse, ApiCookieAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { assertCsrf } from '../auth/csrf';
import { CartService } from './cart.service';

@ApiTags('Cart')
@ApiCookieAuth('sessionCookie')
@Controller('cart')
export class CartController {
  constructor(private readonly auth: AuthService, private readonly cart: CartService) {}
  private async user(cookie?: string) { return this.auth.me(cookie); }
  private csrf(cookie: string | undefined, token: string | undefined, origin: string | undefined) { assertCsrf(cookie, token, origin); }

  @ApiOperation({ summary: 'Get my persistent cart' }) @ApiOkResponse({ description: 'Cart with server-priced estimated totals' }) @ApiUnauthorizedResponse({ description: 'Session required' })
  @Get() async get(@Headers('cookie') cookie?: string) { return this.cart.get((await this.user(cookie)).id); }

  @ApiOperation({ summary: 'Add or increase a cart item' }) @ApiBody({ schema: { required: ['bookId', 'quantity'], properties: { bookId: { type: 'string', format: 'uuid' }, quantity: { type: 'integer', minimum: 1, maximum: 99 } } } }) @ApiOkResponse({ description: 'Updated cart' }) @ApiConflictResponse({ description: 'Book unavailable or requested quantity exceeds stock' })
  @Post('items') async add(@Body() body: Record<string, unknown>, @Headers('cookie') cookie: string | undefined, @Headers('x-csrf-token') csrfToken: string | undefined, @Headers('origin') origin: string | undefined) { this.csrf(cookie, csrfToken, origin); return this.cart.add((await this.user(cookie)).id, body); }

  @ApiOperation({ summary: 'Set a cart item quantity' }) @ApiParam({ name: 'bookId', format: 'uuid' }) @ApiBody({ schema: { required: ['quantity'], properties: { quantity: { type: 'integer', minimum: 1, maximum: 99 } } } }) @ApiOkResponse({ description: 'Updated cart' })
  @Patch('items/:bookId') async change(@Param('bookId') bookId: string, @Body() body: Record<string, unknown>, @Headers('cookie') cookie: string | undefined, @Headers('x-csrf-token') csrfToken: string | undefined, @Headers('origin') origin: string | undefined) { this.csrf(cookie, csrfToken, origin); return this.cart.change((await this.user(cookie)).id, bookId, body.quantity); }

  @ApiOperation({ summary: 'Remove a cart item' }) @ApiParam({ name: 'bookId', format: 'uuid' }) @ApiNoContentResponse({ description: 'Cart item removed' })
  @HttpCode(204) @Delete('items/:bookId') async remove(@Param('bookId') bookId: string, @Headers('cookie') cookie: string | undefined, @Headers('x-csrf-token') csrfToken: string | undefined, @Headers('origin') origin: string | undefined) { this.csrf(cookie, csrfToken, origin); await this.cart.remove((await this.user(cookie)).id, bookId); }
}
