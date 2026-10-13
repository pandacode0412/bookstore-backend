import assert from 'node:assert/strict';
import test from 'node:test';
import { AdminService } from '../dist/modules/admin/admin.service.js';

test('dashboard reports derived metrics and keeps zero-value order statuses', async () => {
  const service = new AdminService({
    book: { count: async ({ where } = {}) => where?.stock ? 2 : where?.status ? 7 : 9 },
    order: {
      count: async ({ where } = {}) => where?.status ? 3 : 12,
      aggregate: async () => ({ _sum: { totalVnd: 460000 } }),
      groupBy: async () => [{ status: 'PENDING', _count: { _all: 3 } }, { status: 'DELIVERED', _count: { _all: 4 } }],
      findMany: async () => [{ id: 'id-1', orderCode: 'BS-1', status: 'PENDING', totalVnd: 120000, createdAt: new Date('2026-01-01T00:00:00.000Z'), user: { fullName: null, email: 'buyer@example.com' }, _count: { items: 2 } }],
    },
  });
  const dashboard = await service.dashboard();
  assert.deepEqual(dashboard.metrics, { totalBooks: 9, publishedBooks: 7, lowStockBooks: 2, totalOrders: 12, pendingOrders: 3, deliveredRevenueVnd: 460000 });
  assert.equal(dashboard.orderStatus.PENDING, 3);
  assert.equal(dashboard.orderStatus.DELIVERED, 4);
  assert.equal(dashboard.orderStatus.CANCELED, 0);
  assert.deepEqual(dashboard.recentOrders[0], { id: 'id-1', orderCode: 'BS-1', status: 'PENDING', totalVnd: 120000, createdAt: new Date('2026-01-01T00:00:00.000Z'), customerName: 'buyer@example.com', itemCount: 2 });
});
