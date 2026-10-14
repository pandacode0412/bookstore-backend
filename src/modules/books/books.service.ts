import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BookStatus, OrderStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

const bookSelect = {
  id: true, sku: true, slug: true, title: true, coverUrl: true,
  priceVnd: true, salePriceVnd: true, stock: true, status: true,
  category: { select: { name: true, slug: true } },
} as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const adminBookSelect = {
  id: true, sku: true, isbn: true, slug: true, title: true, description: true, coverUrl: true,
  priceVnd: true, salePriceVnd: true, stock: true, status: true, createdAt: true, updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },
  images: { select: { id: true, imageUrl: true, sortOrder: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
  bookAuthors: { select: { author: { select: { id: true, name: true } } } },
} satisfies Prisma.BookSelect;
type BookInput = Record<string, unknown>;

@Injectable()
export class BooksService {
  constructor(private readonly db: PrismaService) {}
  async list(
    pageRaw = '1',
    limitRaw = '12',
    q = '',
    categoryRaw = '',
    sortRaw = 'newest',
    onSaleRaw = '',
  ) {
    if (![pageRaw, limitRaw, q, categoryRaw, sortRaw, onSaleRaw].every(value => typeof value === 'string')) {
      throw new BadRequestException('Invalid pagination/search parameters');
    }
    const page = Number(pageRaw ?? '1');
    const limit = Number(limitRaw ?? '12');
    const search = q.trim();
    const category = categoryRaw.trim();
    const sort = sortRaw || 'newest';
    const onSale = onSaleRaw === 'true';
    if (
      !Number.isInteger(page) || page < 1 ||
      !Number.isInteger(limit) || limit < 1 || limit > 50 ||
      search.length > 100 || category.length > 100 ||
      (category !== '' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category)) ||
      !['newest', 'price_asc', 'price_desc', 'bestselling'].includes(sort) ||
      (onSaleRaw !== '' && onSaleRaw !== 'true')
    ) {
      throw new BadRequestException('Invalid pagination/search parameters');
    }
    const where: Prisma.BookWhereInput = {
      status: BookStatus.PUBLISHED,
      ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
      ...(category ? { category: { slug: category } } : {}),
      ...(onSale ? { salePriceVnd: { not: null } } : {}),
    };

    if (sort === 'bestselling') return this.listBestselling(where, page, limit);

    const orderBy: Prisma.BookOrderByWithRelationInput[] = sort === 'price_asc'
      ? [{ priceVnd: 'asc' }, { createdAt: 'desc' }]
      : sort === 'price_desc'
        ? [{ priceVnd: 'desc' }, { createdAt: 'desc' }]
        : [{ createdAt: 'desc' }];
    const [items, total] = await this.db.$transaction([
      this.db.book.findMany({ where, select: bookSelect, orderBy, skip: (page-1) * limit, take: limit }),
      this.db.book.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /** Sales ranking is based only on fulfilled purchases, never carts or canceled/pending orders. */
  private async listBestselling(where: Prisma.BookWhereInput, page: number, limit: number) {
    const ranked = await this.db.orderItem.groupBy({
      by: ['bookId'],
      where: { order: { status: OrderStatus.DELIVERED }, book: where },
      _sum: { quantity: true },
      orderBy: [{ _sum: { quantity: 'desc' } }, { bookId: 'asc' }],
    });
    const total = ranked.length;
    const bookIds = ranked.slice((page - 1) * limit, page * limit).map(item => item.bookId);
    if (bookIds.length === 0) return { items: [], meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };

    const books = await this.db.book.findMany({ where: { ...where, id: { in: bookIds } }, select: bookSelect });
    const byId = new Map(books.map(book => [book.id, book]));
    return {
      items: bookIds.flatMap(id => {
        const book = byId.get(id);
        return book ? [book] : [];
      }),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
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

  async adminList(pageRaw = '1', limitRaw = '20', q = '', statusRaw = '') {
    const page = Number(pageRaw); const limit = Number(limitRaw); const search = q.trim();
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50 || search.length > 100 || (statusRaw && !Object.values(BookStatus).includes(statusRaw as BookStatus))) {
      throw new BadRequestException('Invalid admin book filters');
    }
    const where: Prisma.BookWhereInput = {
      ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }, { slug: { contains: search, mode: 'insensitive' } }] } : {}),
      ...(statusRaw ? { status: statusRaw as BookStatus } : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.book.findMany({ where, select: adminBookSelect, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.db.book.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async adminCreate(input: BookInput) {
    const data = this.bookInput(input, true);
    try {
      return await this.db.$transaction(async (tx) => {
        const authorIds = await this.authorIds(tx, data.authors ?? []);
        return tx.book.create({
          data: {
            sku: data.sku!, slug: data.slug!, title: data.title!, isbn: data.isbn, description: data.description,
            coverUrl: data.coverUrl, priceVnd: data.priceVnd!, salePriceVnd: data.salePriceVnd, stock: data.stock!,
            status: data.status!, categoryId: data.categoryId!,
            images: { create: (data.images ?? []).map((imageUrl, sortOrder) => ({ imageUrl, sortOrder })) },
            bookAuthors: { create: authorIds.map(authorId => ({ authorId })) },
          }, select: adminBookSelect,
        });
      });
    } catch (error: unknown) {
      if (this.isUniqueError(error)) throw new ConflictException('Book SKU, slug, or ISBN already exists');
      if (this.isMissingError(error) || this.isForeignKeyError(error)) throw new NotFoundException('Category not found');
      throw error;
    }
  }

  async adminUpdate(actorId: string, rawId: string, input: BookInput) {
    if (!UUID_PATTERN.test(rawId)) throw new BadRequestException('Invalid book id');
    const data = this.bookInput(input, false);
    if (Object.keys(input).length === 0) throw new BadRequestException('Provide at least one book field');
    try {
      return await this.db.$transaction(async (tx) => {
        const existing = await tx.book.findUnique({ where: { id: rawId }, select: { id: true, stock: true, priceVnd: true, salePriceVnd: true } });
        if (!existing) throw new NotFoundException('Book not found');
        const resultingPrice = data.priceVnd ?? existing.priceVnd;
        const resultingSalePrice = data.salePriceVnd === undefined ? existing.salePriceVnd : data.salePriceVnd;
        if (resultingSalePrice !== null && resultingSalePrice > resultingPrice) throw new BadRequestException('Sale price cannot exceed price');
        const authors = data.authors === undefined ? undefined : await this.authorIds(tx, data.authors);
        return tx.book.update({
          where: { id: rawId },
          data: {
            ...(data.sku !== undefined ? { sku: data.sku } : {}), ...(data.slug !== undefined ? { slug: data.slug } : {}),
            ...(data.title !== undefined ? { title: data.title } : {}), ...(data.isbn !== undefined ? { isbn: data.isbn } : {}),
            ...(data.description !== undefined ? { description: data.description } : {}), ...(data.coverUrl !== undefined ? { coverUrl: data.coverUrl } : {}),
            ...(data.priceVnd !== undefined ? { priceVnd: data.priceVnd } : {}), ...(data.salePriceVnd !== undefined ? { salePriceVnd: data.salePriceVnd } : {}),
            ...(data.stock !== undefined ? { stock: data.stock } : {}), ...(data.status !== undefined ? { status: data.status } : {}),
            ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
            ...(data.images !== undefined ? { images: { deleteMany: {}, create: data.images.map((imageUrl, sortOrder) => ({ imageUrl, sortOrder })) } } : {}),
            ...(authors !== undefined ? { bookAuthors: { deleteMany: {}, create: authors.map(authorId => ({ authorId })) } } : {}),
            ...(data.stock !== undefined && data.stock !== existing.stock ? { stockMovements: { create: { actorId, delta: data.stock - existing.stock, reason: 'ADMIN_ADJUSTMENT', sourceKey: `admin:book:${rawId}:stock:${randomUUID()}`, note: 'Admin catalog stock update' } } } : {}),
          }, select: adminBookSelect,
        });
      });
    } catch (error: unknown) {
      if (this.isUniqueError(error)) throw new ConflictException('Book SKU, slug, or ISBN already exists');
      if (this.isMissingError(error) || this.isForeignKeyError(error)) throw new NotFoundException('Book or category not found');
      throw error;
    }
  }

  private bookInput(input: BookInput, creating: boolean) {
    const fields = ['sku', 'slug', 'title', 'isbn', 'description', 'coverUrl', 'priceVnd', 'salePriceVnd', 'stock', 'status', 'categoryId', 'images', 'authors'];
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !fields.includes(key))) throw new BadRequestException('Invalid book payload');
    const required = (field: string) => creating && !Object.hasOwn(input, field);
    for (const field of ['sku', 'slug', 'title', 'priceVnd', 'stock', 'status', 'categoryId']) if (required(field)) throw new BadRequestException(`Missing ${field}`);
    const text = (value: unknown, field: string, min: number, max: number, pattern?: RegExp) => {
      if (value === undefined && !creating) return undefined;
      if (typeof value !== 'string') throw new BadRequestException(`Invalid book ${field}`);
      const normalized = value.trim();
      if (normalized.length < min || normalized.length > max || (pattern && !pattern.test(normalized))) throw new BadRequestException(`Invalid book ${field}`);
      return normalized;
    };
    const nullableText = (value: unknown, field: string, max: number) => {
      if (value === undefined && !creating) return undefined;
      if (value === null || value === '') return null;
      return text(value, field, 1, max);
    };
    const integer = (value: unknown, field: string) => {
      if (value === undefined && !creating) return undefined;
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 2_000_000_000) throw new BadRequestException(`Invalid book ${field}`);
      return value;
    };
    const priceVnd = integer(input.priceVnd, 'price');
    const salePriceVnd = input.salePriceVnd === undefined && !creating
      ? undefined
      : input.salePriceVnd === null
        ? null
        : integer(input.salePriceVnd, 'sale price');
    if (priceVnd !== undefined && salePriceVnd !== undefined && salePriceVnd !== null && salePriceVnd > priceVnd) throw new BadRequestException('Sale price cannot exceed price');
    const status = input.status === undefined && !creating ? undefined : (typeof input.status === 'string' && Object.values(BookStatus).includes(input.status as BookStatus) ? input.status as BookStatus : (() => { throw new BadRequestException('Invalid book status'); })());
    const categoryId = input.categoryId === undefined && !creating ? undefined : (typeof input.categoryId === 'string' && UUID_PATTERN.test(input.categoryId) ? input.categoryId : (() => { throw new BadRequestException('Invalid category id'); })());
    const url = (value: unknown, field: string) => {
      const result = nullableText(value, field, 2048);
      if (result === null || result === undefined) return result;
      if (!/^(https:\/\/|\/)/.test(result)) throw new BadRequestException(`Invalid book ${field}`);
      return result;
    };
    const images = input.images === undefined && !creating ? undefined : (() => {
      if (input.images === undefined) return [] as string[];
      if (!Array.isArray(input.images) || input.images.length > 8 || input.images.some(item => typeof item !== 'string' || !/^(https:\/\/|\/)/.test(item.trim()) || item.trim().length > 2048)) throw new BadRequestException('Invalid book images');
      return [...new Set(input.images.map(item => item.trim()))];
    })();
    const authors = input.authors === undefined && !creating ? undefined : (() => {
      if (input.authors === undefined) return [] as string[];
      if (!Array.isArray(input.authors) || input.authors.length > 5 || input.authors.some(item => typeof item !== 'string' || item.trim().length < 1 || item.trim().length > 120)) throw new BadRequestException('Invalid book authors');
      return [...new Set(input.authors.map(item => item.trim().replace(/\s+/g, ' ')))];
    })();
    return { sku: text(input.sku, 'sku', 1, 64), slug: text(input.slug, 'slug', 1, 120, SLUG_PATTERN), title: text(input.title, 'title', 1, 255), isbn: nullableText(input.isbn, 'ISBN', 32), description: nullableText(input.description, 'description', 20_000), coverUrl: url(input.coverUrl, 'cover URL'), priceVnd, salePriceVnd, stock: integer(input.stock, 'stock'), status, categoryId, images, authors };
  }

  private async authorIds(tx: Prisma.TransactionClient, names: string[]) {
    const ids: string[] = [];
    for (const name of names) {
      const author = await tx.author.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
      ids.push(author?.id ?? (await tx.author.create({ data: { name }, select: { id: true } })).id);
    }
    return ids;
  }
  private isUniqueError(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'; }
  private isMissingError(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025'; }
  private isForeignKeyError(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2003'; }
}
