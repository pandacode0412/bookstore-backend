import { Injectable } from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const LOW_STOCK_THRESHOLD = 5;

@Injectable()
export class AdminService {
  constructor(private readonly db: PrismaService) {}

  /** Read-only operating metrics. Revenue intentionally includes DELIVERED orders only. */
  async dashboard() {
    const [totalBooks, publishedBooks, lowStockBooks, totalOrders, pendingOrders, totalCustomers, delivered, groupedStatuses, recentOrders, soldBooks] = await Promise.all([
      this.db.book.count(),
      this.db.book.count({ where: { status: 'PUBLISHED' } }),
      this.db.book.count({ where: { stock: { lte: LOW_STOCK_THRESHOLD }, status: 'PUBLISHED' } }),
      this.db.order.count(),
      this.db.order.count({ where: { status: OrderStatus.PENDING } }),
      this.db.user.count({ where: { role: Role.CUSTOMER } }),
      this.db.order.aggregate({ where: { status: OrderStatus.DELIVERED }, _sum: { totalVnd: true } }),
      this.db.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.db.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, orderCode: true, status: true, totalVnd: true, createdAt: true,
          user: { select: { fullName: true, email: true } },
          _count: { select: { items: true } },
        },
      }),
      this.db.orderItem.groupBy({ by: ['bookId'], where: { order: { status: OrderStatus.DELIVERED } }, _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 5 }),
    ]);
    const books = soldBooks.length ? await this.db.book.findMany({ where: { id: { in: soldBooks.map(item => item.bookId) } }, select: { id: true, title: true, sku: true } }) : [];
    const booksById = new Map(books.map(book => [book.id, book]));

    const orderStatus = Object.fromEntries(Object.values(OrderStatus).map((status) => [status, 0])) as Record<OrderStatus, number>;
    for (const entry of groupedStatuses) orderStatus[entry.status] = entry._count._all;

    return {
      metrics: {
        totalBooks,
        publishedBooks,
        lowStockBooks,
        totalOrders,
        totalCustomers,
        pendingOrders,
        deliveredRevenueVnd: delivered._sum.totalVnd ?? 0,
      },
      orderStatus,
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        orderCode: order.orderCode,
        status: order.status,
        totalVnd: order.totalVnd,
        createdAt: order.createdAt,
        customerName: order.user.fullName || order.user.email,
        itemCount: order._count.items,
      })),
      topSellingBooks: soldBooks.flatMap(item => {
        const book = booksById.get(item.bookId);
        return book ? [{ id: book.id, title: book.title, sku: book.sku, soldQuantity: item._sum.quantity ?? 0 }] : [];
      }),
    };
  }

  async customers(pageRaw = '1', limitRaw = '20', queryRaw = '') {
    const page = Number(pageRaw); const limit = Number(limitRaw); const query = queryRaw.trim();
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50 || query.length > 100) throw new Error('Invalid customer filters');
    const where = { role: Role.CUSTOMER, ...(query ? { OR: [{ email: { contains: query, mode: 'insensitive' as const } }, { fullName: { contains: query, mode: 'insensitive' as const } }] } : {}) };
    const [items, total] = await this.db.$transaction([
      this.db.user.findMany({ where, select: { id: true, fullName: true, email: true, createdAt: true, _count: { select: { orders: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.db.user.count({ where }),
    ]);
    return { items: items.map(item => ({ id: item.id, fullName: item.fullName, email: item.email, createdAt: item.createdAt, orderCount: item._count.orders })), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
