import assert from 'node:assert/strict';
import test from 'node:test';
import { BooksService } from '../dist/modules/books/books.service.js';
import { CategoriesService } from '../dist/modules/categories/categories.service.js';

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
  await assert.rejects(() => service.list('1', '12', ['multiple values']), /Invalid pagination\/search parameters/);
});

test('public categories only query categories with a published book', async () => {
  let received;
  const db = { category: { findMany: (args) => { received = args; return Promise.resolve([]); } } };
  await new CategoriesService(db).listPublic();
  assert.deepEqual(received, {
    where: { books: { some: { status: 'PUBLISHED' } } },
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });
});
