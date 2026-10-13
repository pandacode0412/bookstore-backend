import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const LOW_STOCK_THRESHOLD = 5;

@Injectable()
export class AdminService {
  constructor(private readonly db: PrismaService) {}

  /** Read-only operating metrics. Revenue intentionally includes DELIVERED orders only. */
  async dashboard() {
    const [totalBooks, publishedBooks, lowStockBooks, totalOrders, pendingOrders, delivered, groupedStatuses, recentOrders] = await Promise.all([
      this.db.book.count(),
      this.db.book.count({ where: { status: 'PUBLISHED' } }),
      this.db.book.count({ where: { stock: { lte: LOW_STOCK_THRESHOLD }, status: 'PUBLISHED' } }),
      this.db.order.count(),
      this.db.order.count({ where: { status: OrderStatus.PENDING } }),
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
    ]);

    const orderStatus = Object.fromEntries(Object.values(OrderStatus).map((status) => [status, 0])) as Record<OrderStatus, number>;
    for (const entry of groupedStatuses) orderStatus[entry.status] = entry._count._all;

    return {
      metrics: {
        totalBooks,
        publishedBooks,
        lowStockBooks,
        totalOrders,
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
    };
  }
}
