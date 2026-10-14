import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { BooksService } from './books.service';

@ApiTags('Catalog')
@Controller('books')
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @ApiOperation({ summary: 'List published books' })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, minimum: 1, maximum: 50, example: 12 })
  @ApiQuery({ name: 'q', required: false, type: String, maxLength: 100, description: 'Case-insensitive title search' })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Lowercase category slug', example: 'lap-trinh' })
  @ApiQuery({ name: 'sort', required: false, enum: ['newest', 'price_asc', 'price_desc', 'bestselling'], description: 'Price uses priceVnd (base price). bestselling ranks quantities from DELIVERED orders only.' })
  @ApiQuery({ name: 'onSale', required: false, enum: ['true'], description: 'When true, return published books with a configured sale price.' })
  @ApiOkResponse({ description: 'Paginated published books' })
  @ApiBadRequestResponse({ description: 'Invalid pagination, search, category, sort, or onSale value' })
  @Get() list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('sort') sort?: string,
    @Query('onSale') onSale?: string,
  ) {
    return this.books.list(page, limit, q, category, sort, onSale);
  }
  @ApiOperation({ summary: 'Get a published book by slug' })
  @ApiParam({ name: 'slug', example: 'clean-code' })
  @ApiOkResponse({ description: 'Published book detail' })
  @ApiNotFoundResponse({ description: 'No published book with this slug' })
  @Get(':slug') detail(@Param('slug') slug: string) { return this.books.detail(slug); }
}
