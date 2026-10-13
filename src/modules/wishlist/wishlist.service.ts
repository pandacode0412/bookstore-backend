import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bookSelect = { id: true, sku: true, slug: true, title: true, coverUrl: true, priceVnd: true, salePriceVnd: true, stock: true, status: true, category: { select: { name: true, slug: true } } } as const;

@Injectable()
export class WishlistService {
  constructor(private readonly db: PrismaService) {}

  async get(userId: string) {
    const items = await this.db.wishlistItem.findMany({ where: { userId }, include: { book: { select: bookSelect } }, orderBy: { createdAt: 'desc' } });
    return { items: items.map(item => item.book) };
  }

  async add(userId: string, rawBookId: unknown) {
    const bookId = this.bookId(rawBookId);
    const book = await this.db.book.findFirst({ where: { id: bookId, status: BookStatus.PUBLISHED }, select: { id: true } });
    if (!book) throw new NotFoundException('Book not found');
    await this.db.wishlistItem.upsert({ where: { userId_bookId: { userId, bookId } }, create: { userId, bookId }, update: {} });
    return this.get(userId);
  }

  async remove(userId: string, rawBookId: unknown) {
    const bookId = this.bookId(rawBookId);
    await this.db.wishlistItem.deleteMany({ where: { userId, bookId } });
  }

  private bookId(value: unknown) {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new BadRequestException('Invalid book id');
    return value;
  }
}
