import assert from 'node:assert/strict';
import test from 'node:test';
import { WishlistService } from '../dist/modules/wishlist/wishlist.service.js';

const bookId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const book = { id: bookId, sku: 'BK-001', slug: 'deep-work', title: 'Deep Work', coverUrl: null, priceVnd: 180000, salePriceVnd: null, stock: 3, status: 'PUBLISHED', category: { name: 'Kỹ năng', slug: 'ky-nang' } };

test('wishlist returns only the current user saved books and add is idempotent', async () => {
  const writes = [];
  const db = {
    wishlistItem: {
      findMany: async (args) => { assert.equal(args.where.userId, userId); return [{ book }]; },
      upsert: async (args) => writes.push(args),
    },
    book: { findFirst: async () => ({ id: bookId }) },
  };
  const service = new WishlistService(db);
  assert.deepEqual(await service.get(userId), { items: [book] });
  assert.deepEqual(await service.add(userId, bookId), { items: [book] });
  assert.deepEqual(writes[0].where.userId_bookId, { userId, bookId });
});

test('wishlist validates ids, rejects unavailable books, and deletion is scoped to its owner', async () => {
  const deletes = [];
  const service = new WishlistService({
    wishlistItem: { deleteMany: async (args) => deletes.push(args), upsert: async () => undefined },
    book: { findFirst: async () => null },
  });
  await assert.rejects(() => service.add(userId, bookId), /Book not found/);
  await assert.rejects(() => service.remove(userId, 'not-a-uuid'), /Invalid book id/);
  await service.remove(userId, bookId);
  assert.deepEqual(deletes[0].where, { userId, bookId });
});
