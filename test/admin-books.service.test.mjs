import assert from 'node:assert/strict';
import test from 'node:test';
import { BooksService } from '../dist/modules/books/books.service.js';

const bookId = '11111111-1111-4111-8111-111111111111';
const categoryId = '22222222-2222-4222-8222-222222222222';

test('admin book list applies the real category and status filters', async () => {
  const calls = [];
  const service = new BooksService({
    book: {
      findMany: async (args) => { calls.push(args); return []; },
      count: async (args) => { calls.push(args); return 0; },
    },
    $transaction: async (operations) => Promise.all(operations),
  });
  const result = await service.adminList('2', '20', ' clean ', 'PUBLISHED', categoryId);
  assert.deepEqual(result.meta, { page: 2, limit: 20, total: 0, totalPages: 0 });
  assert.deepEqual(calls[0].where, {
    OR: [
      { title: { contains: 'clean', mode: 'insensitive' } },
      { sku: { contains: 'clean', mode: 'insensitive' } },
      { slug: { contains: 'clean', mode: 'insensitive' } },
    ],
    status: 'PUBLISHED',
    categoryId,
  });
  await assert.rejects(() => service.adminList('1', '20', '', '', 'not-a-uuid'), /Invalid admin book filters/);
});

test('admin book summary uses database counts rather than paginated list data', async () => {
  const calls = [];
  const values = [21, 12, 4, 5, 3];
  const service = new BooksService({
    book: { count: async (args) => { calls.push(args); return values.shift(); } },
    $transaction: async (operations) => Promise.all(operations),
  });
  assert.deepEqual(await service.adminSummary(), { total: 21, published: 12, draft: 4, archived: 5, outOfStock: 3 });
  assert.deepEqual(calls.map((call) => call.where), [{}, { status: 'PUBLISHED' }, { status: 'DRAFT' }, { status: 'ARCHIVED' }, { stock: 0 }]);
});

test('admin book detail validates the id and returns only an existing record', async () => {
  const service = new BooksService({ book: { findUnique: async () => ({ id: bookId }) } });
  assert.deepEqual(await service.adminDetail(bookId), { id: bookId });
  await assert.rejects(() => service.adminDetail('invalid'), /Invalid book id/);
  const missing = new BooksService({ book: { findUnique: async () => null } });
  await assert.rejects(() => missing.adminDetail(bookId), /Book not found/);
});
