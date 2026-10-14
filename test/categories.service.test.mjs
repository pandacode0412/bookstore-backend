import assert from 'node:assert/strict';
import test from 'node:test';
import { CategoriesService } from '../dist/modules/categories/categories.service.js';

test('public categories include only active records ordered by sortOrder then name', async () => {
  let received;
  const db = { category: { findMany: (args) => { received = args; return Promise.resolve([]); } } };
  await new CategoriesService(db).listPublic();
  assert.deepEqual(received, {
    where: { isActive: true },
    select: { id: true, name: true, slug: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
});

test('admin category create and update validate shape and persist active state/order', async () => {
  const calls = { create: [], update: [] };
  const db = { category: {
    create: (args) => { calls.create.push(args); return Promise.resolve({ id: 'cat', ...args.data }); },
    update: (args) => { calls.update.push(args); return Promise.resolve({ id: args.where.id, ...args.data }); },
  } };
  const service = new CategoriesService(db);
  await service.create({ name: '  Văn học  ', slug: 'van-hoc', sortOrder: 8 });
  assert.deepEqual(calls.create[0].data, { name: 'Văn học', slug: 'van-hoc', description: null, isActive: true, sortOrder: 8 });

  await service.update('a0f0f0f0-0000-4000-8000-000000000001', { isActive: false, sortOrder: 3 });
  assert.deepEqual(calls.update[0].where, { id: 'a0f0f0f0-0000-4000-8000-000000000001' });
  assert.deepEqual(calls.update[0].data, { isActive: false, sortOrder: 3 });

  await assert.rejects(() => service.create({ name: 'Địa lý', slug: 'DIA-LY' }), /Invalid category slug/);
  await assert.rejects(() => service.update('invalid-id', { isActive: true }), /Invalid category id/);
  await assert.rejects(() => service.update('a0f0f0f0-0000-4000-8000-000000000001', {}), /Provide at least one category field/);
});
