import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BooksService {
  constructor(private readonly db: PrismaService) {}
  async list(
    pageRaw = '1',
    limitRaw = '12',
    q = '',
    categoryRaw = '',
    sortRaw = 'newest',
  ) {
    if (![pageRaw, limitRaw, q, categoryRaw, sortRaw].every(value => typeof value === 'string')) {
      throw new BadRequestException('Invalid pagination/search parameters');
    }
    const page = Number(pageRaw ?? '1');
    const limit = Number(limitRaw ?? '12');
    const search = q.trim();
    const category = categoryRaw.trim();
    const sort = sortRaw || 'newest';
    if (
      !Number.isInteger(page) || page < 1 ||
      !Number.isInteger(limit) || limit < 1 || limit > 50 ||
      search.length > 100 || category.length > 100 ||
      (category !== '' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category)) ||
      !['newest', 'price_asc', 'price_desc'].includes(sort)
    ) {
      throw new BadRequestException('Invalid pagination/search parameters');
    }
    const where: Prisma.BookWhereInput = {
      status: BookStatus.PUBLISHED,
      ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
      ...(category ? { category: { slug: category } } : {}),
    };
    const orderBy: Prisma.BookOrderByWithRelationInput[] = sort === 'price_asc'
      ? [{ priceVnd: 'asc' }, { createdAt: 'desc' }]
      : sort === 'price_desc'
        ? [{ priceVnd: 'desc' }, { createdAt: 'desc' }]
        : [{ createdAt: 'desc' }];
    const [items, total] = await this.db.$transaction([
      this.db.book.findMany({ where, select: {
        id: true, sku: true, slug: true, title: true, coverUrl: true,
        priceVnd: true, salePriceVnd: true, stock: true, status: true,
        category: { select: { name: true, slug: true } },
      }, orderBy, skip: (page-1) * limit, take: limit }),
      this.db.book.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  async detail(slug: string) {
    const book = await this.db.book.findFirst({
      where: { slug, status: BookStatus.PUBLISHED },
      select: { id:true, sku:true, isbn:true, slug:true, title:true, description:true,
        coverUrl:true, priceVnd:true, salePriceVnd:true, stock:true, status:true,
        category:{select:{name:true,slug:true}}, bookAuthors:{select:{author:{select:{name:true}}}}
      },
    });
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }
}
