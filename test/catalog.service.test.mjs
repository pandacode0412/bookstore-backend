import assert from 'node:assert/strict';
import test from 'node:test';
import { BooksService } from '../dist/modules/books/books.service.js';

function bookDb() {
  const calls = { findMany: [], count: [] };
  const db = {
    book: {
      findMany: (args) => { calls.findMany.push(args); return Promise.resolve([]); },
      count: (args) => { calls.count.push(args); return Promise.resolve(0); },
    },
    $transaction: (queries) => Promise.all(queries),
  };
  return { db, calls };
}

test('catalog filters published books by title and category, then sorts base price', async () => {
  const { db, calls } = bookDb();
  const result = await new BooksService(db).list('2', '10', ' clean ', 'lap-trinh', 'price_asc');

  assert.deepEqual(result.meta, { page: 2, limit: 10, total: 0, totalPages: 0 });
  assert.deepEqual(calls.findMany[0].where, {
    status: 'PUBLISHED',
    title: { contains: 'clean', mode: 'insensitive' },
    category: { slug: 'lap-trinh' },
  });
  assert.deepEqual(calls.findMany[0].orderBy, [{ priceVnd: 'asc' }, { createdAt: 'desc' }]);
  assert.equal(calls.findMany[0].skip, 10);
  assert.deepEqual(calls.count[0].where, calls.findMany[0].where);
});
test('catalog rejects invalid pagination, category slug, and sort values', async () => {
  const { db } = bookDb();
  const service = new BooksService(db);
  await assert.rejects(() => service.list('0'), /Invalid pagination\/search parameters/);
  await assert.rejects(() => service.list('1', '12', '', 'Not A Slug'), /Invalid pagination\/search parameters/);
  await assert.rejects(() => service.list('1', '12', '', '', 'popular'), /Invalid pagination\/search parameters/);
  await assert.rejects(() => service.list('1', '12', '', '', 'newest', 'yes'), /Invalid pagination\/search parameters/);
  await assert.rejects(() => service.list('1', '12', ['multiple values']), /Invalid pagination\/search parameters/);
});

test('catalog promotion filter only includes published books with a sale price', async () => {
  const { db, calls } = bookDb();
  await new BooksService(db).list('1', '12', '', '', 'newest', 'true');
  assert.deepEqual(calls.findMany[0].where, {
    status: 'PUBLISHED',
    salePriceVnd: { not: null },
  });
});

test('bestselling catalog only ranks quantities from delivered orders and preserves that ranking', async () => {
  const calls = { groupBy: [], findMany: [] };
  const db = {
    orderItem: {
      groupBy: (args) => {
        calls.groupBy.push(args);
        return Promise.resolve([{ bookId: 'book-b', _sum: { quantity: 7 } }, { bookId: 'book-a', _sum: { quantity: 3 } }]);
      },
    },
    book: {
      findMany: (args) => {
        calls.findMany.push(args);
        return Promise.resolve([{ id: 'book-a', title: 'A' }, { id: 'book-b', title: 'B' }]);
      },
    },
  };

  const result = await new BooksService(db).list('1', '12', '', '', 'bestselling');
  assert.deepEqual(calls.groupBy[0].where, { order: { status: 'DELIVERED' }, book: { status: 'PUBLISHED' } });
  assert.deepEqual(calls.groupBy[0].orderBy, [{ _sum: { quantity: 'desc' } }, { bookId: 'asc' }]);
  assert.deepEqual(calls.findMany[0].where, { status: 'PUBLISHED', id: { in: ['book-b', 'book-a'] } });
  assert.deepEqual(result.items.map(book => book.id), ['book-b', 'book-a']);
  assert.deepEqual(result.meta, { page: 1, limit: 12, total: 2, totalPages: 1 });
});
