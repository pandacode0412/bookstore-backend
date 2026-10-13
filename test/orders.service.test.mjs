import assert from 'node:assert/strict';
import test from 'node:test';
import { OrdersService } from '../dist/modules/orders/orders.service.js';

const key = '11111111-1111-4111-8111-111111111111';
const addressId = '22222222-2222-4222-8222-222222222222';
const bookId = '33333333-3333-4333-8333-333333333333';

test('checkout snapshots server price, decrements conditionally, creates movement, and clears the cart', async () => {
  const writes = [];
  const tx = {
    order: {
      findUnique: async () => null,
      create: async ({ data }) => {
        writes.push(['order', data]);
        return { id: data.id, orderCode: data.orderCode, status: 'PENDING', paymentMethod: 'COD', subtotalVnd: data.subtotalVnd, shippingFeeVnd: 0, totalVnd: data.totalVnd, addressSnapshot: data.addressSnapshot, note: data.note, createdAt: new Date('2026-01-01T00:00:00Z'), items: data.items.create, payments: [{ status: 'UNPAID' }] };
      },
    },
    address: { findFirst: async () => ({ id: addressId, recipientName: 'Nguyễn An', phone: '0900000000', line1: '1 Đường Sách', ward: null, district: 'Quận 1', city: 'Hồ Chí Minh' }) },
    cart: { findUnique: async () => ({ id: 'cart-1', items: [{ bookId, quantity: 2, book: { id: bookId, sku: 'BK-1', title: 'Sách thật', priceVnd: 120000, salePriceVnd: 99000, stock: 2, status: 'PUBLISHED' } }] }) },
    book: { updateMany: async (args) => { writes.push(['decrement', args]); return { count: 1 }; } },
    cartItem: { deleteMany: async (args) => writes.push(['clear', args]) },
  };
  const service = new OrdersService({ $transaction: async (callback) => callback(tx) });
  const order = await service.checkout('user-1', key, { addressId, paymentMethod: 'COD', note: '  Buổi sáng  ' });
  assert.equal(order.subtotalVnd, 198000);
  assert.equal(order.totalVnd, 198000);
  assert.equal(order.items[0].unitPriceVnd, 99000);
  assert.equal(order.items[0].lineTotalVnd, 198000);
  assert.equal(writes.find(([name]) => name === 'decrement')[1].where.stock.gte, 2);
  assert.equal(writes.find(([name]) => name === 'clear')[1].where.cartId, 'cart-1');
  const created = writes.find(([name]) => name === 'order')[1];
  assert.equal(created.inventoryMovements.create[0].delta, -2);
  assert.equal(created.note, 'Buổi sáng');
});

test('pending cancellation restores every item once after a conditional state transition', async () => {
  const writes = [];
  const existing = { id: '44444444-4444-4444-8444-444444444444', orderCode: 'BS-TEST', status: 'PENDING', paymentMethod: 'COD', subtotalVnd: 99000, shippingFeeVnd: 0, totalVnd: 99000, addressSnapshot: {}, note: null, createdAt: new Date('2026-01-01T00:00:00Z'), payments: [{ status: 'UNPAID' }], items: [{ bookId, skuSnapshot: 'BK-1', titleSnapshot: 'Sách thật', unitPriceVnd: 99000, quantity: 1, lineTotalVnd: 99000 }] };
  const tx = {
    order: { findFirst: async () => existing, updateMany: async (args) => { writes.push(['status', args]); return { count: 1 }; } },
    book: { update: async (args) => writes.push(['restore', args]) },
    inventoryMovement: { create: async (args) => writes.push(['movement', args]) },
  };
  const service = new OrdersService({ $transaction: async (callback) => callback(tx) });
  const order = await service.cancel('user-1', existing.id);
  assert.equal(order.status, 'CANCELED');
  assert.equal(writes.find(([name]) => name === 'status')[1].where.status, 'PENDING');
  assert.equal(writes.find(([name]) => name === 'restore')[1].data.stock.increment, 1);
  assert.equal(writes.find(([name]) => name === 'movement')[1].data.delta, 1);
});
