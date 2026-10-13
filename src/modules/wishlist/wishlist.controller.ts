import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { assertCsrf } from '../auth/csrf';
import { WishlistService } from './wishlist.service';

@ApiTags('Wishlist')
@ApiCookieAuth('sessionCookie')
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly auth: AuthService, private readonly wishlist: WishlistService) {}

  @ApiOperation({ summary: 'List my saved books' })
  @ApiOkResponse({ description: 'Saved published books' })
  @ApiUnauthorizedResponse({ description: 'Session required' })
  @Get()
  async get(@Headers('cookie') cookie?: string) { return this.wishlist.get((await this.auth.me(cookie)).id); }

  @ApiOperation({ summary: 'Save a book to my wishlist' })
  @ApiBody({ schema: { required: ['bookId'], properties: { bookId: { type: 'string', format: 'uuid' } } } })
  @ApiOkResponse({ description: 'Updated wishlist; adding an existing book is idempotent' })
  @Post('items')
  async add(@Body() body: Record<string, unknown>, @Headers('cookie') cookie: string | undefined, @Headers('x-csrf-token') csrfToken: string | undefined, @Headers('origin') origin: string | undefined) {
    assertCsrf(cookie, csrfToken, origin);
    return this.wishlist.add((await this.auth.me(cookie)).id, body.bookId);
  }

  @ApiOperation({ summary: 'Remove a book from my wishlist' })
  @ApiParam({ name: 'bookId', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Book removed; removing an absent book is idempotent' })
  @HttpCode(204)
  @Delete('items/:bookId')
  async remove(@Param('bookId') bookId: string, @Headers('cookie') cookie: string | undefined, @Headers('x-csrf-token') csrfToken: string | undefined, @Headers('origin') origin: string | undefined) {
    assertCsrf(cookie, csrfToken, origin);
    await this.wishlist.remove((await this.auth.me(cookie)).id, bookId);
  }
}
