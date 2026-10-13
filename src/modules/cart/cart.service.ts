import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BookStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bookSelect = { id: true, sku: true, slug: true, title: true, coverUrl: true, priceVnd: true, salePriceVnd: true, stock: true, status: true, category: { select: { name: true, slug: true } } } as const;

@Injectable()
export class CartService {
  constructor(private readonly db: PrismaService) {}

  async get(userId: string) {
    const cart = await this.db.cart.findUnique({ where: { userId }, include: { items: { include: { book: { select: bookSelect } }, orderBy: { createdAt: 'desc' } } } });
    return this.present(cart?.items ?? []);
  }

  async add(userId: string, input: { bookId?: unknown; quantity?: unknown }) {
    const bookId = this.bookId(input.bookId);
    const quantity = this.quantity(input.quantity);
    const book = await this.db.book.findFirst({ where: { id: bookId, status: BookStatus.PUBLISHED }, select: { id: true, stock: true } });
    if (!book) throw new NotFoundException('Book not found');
    if (book.stock === 0) throw new ConflictException('Book is out of stock');
    const cart = await this.db.cart.upsert({ where: { userId }, create: { userId }, update: {} });
    const existing = await this.db.cartItem.findUnique({ where: { cartId_bookId: { cartId: cart.id, bookId } } });
    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    if (nextQuantity > 99) throw new BadRequestException('Quantity must be between 1 and 99');
    if (nextQuantity > book.stock) throw new ConflictException('Requested quantity exceeds stock');
    await this.db.cartItem.upsert({ where: { cartId_bookId: { cartId: cart.id, bookId } }, create: { cartId: cart.id, bookId, quantity }, update: { quantity: nextQuantity } });
    return this.get(userId);
  }

  async change(userId: string, rawBookId: unknown, rawQuantity: unknown) {
    const bookId = this.bookId(rawBookId);
    const quantity = this.quantity(rawQuantity);
    const cart = await this.db.cart.findUnique({ where: { userId } });
    if (!cart) throw new NotFoundException('Cart item not found');
    const item = await this.db.cartItem.findUnique({ where: { cartId_bookId: { cartId: cart.id, bookId } }, include: { book: { select: { stock: true, status: true } } } });
    if (!item) throw new NotFoundException('Cart item not found');
    if (item.book.status !== BookStatus.PUBLISHED || item.book.stock === 0) throw new ConflictException('Book is unavailable');
    if (quantity > item.book.stock) throw new ConflictException('Requested quantity exceeds stock');
    await this.db.cartItem.update({ where: { cartId_bookId: { cartId: cart.id, bookId } }, data: { quantity } });
    return this.get(userId);
  }

  async remove(userId: string, rawBookId: unknown) {
    const bookId = this.bookId(rawBookId);
    const cart = await this.db.cart.findUnique({ where: { userId } });
    if (!cart) throw new NotFoundException('Cart item not found');
    const result = await this.db.cartItem.deleteMany({ where: { cartId: cart.id, bookId } });
    if (result.count === 0) throw new NotFoundException('Cart item not found');
  }

  private present(items: Array<{ quantity: number; book: { id: string; priceVnd: number; salePriceVnd: number | null } } & Record<string, unknown>>) {
    const lines = items.map(({ book, quantity, ...rest }) => {
      const unitPriceVnd = book.salePriceVnd ?? book.priceVnd;
      return { ...rest, book, quantity, unitPriceVnd, lineTotalVnd: unitPriceVnd * quantity };
    });
    return { items: lines, estimatedSubtotalVnd: lines.reduce((total, line) => total + line.lineTotalVnd, 0) };
  }

  private bookId(value: unknown) {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new BadRequestException('Invalid book id');
    return value;
  }

  private quantity(value: unknown) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 99) throw new BadRequestException('Quantity must be between 1 and 99');
    return value;
  }
}
