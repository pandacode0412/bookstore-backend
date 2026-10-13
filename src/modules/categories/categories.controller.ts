import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';

@ApiTags('Catalog')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @ApiOperation({ summary: 'List categories with published books' })
  @ApiOkResponse({
    description: 'Public category list',
    schema: { example: [{ id: 'uuid', name: 'Lập trình', slug: 'lap-trinh' }] },
  })
  @Get()
  list() {
    return this.categories.listPublic();
  }
}
