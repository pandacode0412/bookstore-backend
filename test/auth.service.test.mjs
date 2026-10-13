import assert from 'node:assert/strict';
import test from 'node:test';
import { hash } from 'bcryptjs';
import { AuthService } from '../dist/modules/auth/auth.service.js';

test('registration normalizes email, creates a session, and never returns a password hash', async () => {
  let received;
  const writes = [];
  const db = {
    user: { create: async (args) => { received = args; return { id: 'user-1', email: args.data.email, fullName: args.data.fullName, role: 'CUSTOMER' }; } },
    $transaction: async (callback) => callback({ session: { deleteMany: async (args) => writes.push(['deleteMany', args]), create: async (args) => writes.push(['create', args]) } }),
  };
  const session = await new AuthService(db).register({ email: '  Reader@Example.Test ', password: 'a-secure-password', fullName: ' Reader ' });
  assert.equal(received.data.email, 'reader@example.test');
  assert.equal(received.data.fullName, 'Reader');
  assert.notEqual(received.data.passwordHash, 'a-secure-password');
  assert.deepEqual(session.user, { id: 'user-1', email: 'reader@example.test', fullName: 'Reader', role: 'CUSTOMER' });
  assert.match(session.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(writes[1][1].data.tokenHash.length, 64);
});

test('login rotates sessions and only persists a token hash', async () => {
  const passwordHash = await hash('a-secure-password', 12);
  const writes = [];
  const db = {
    user: { findUnique: async () => ({ id: 'user-1', email: 'reader@example.test', fullName: null, role: 'CUSTOMER', passwordHash }) },
    $transaction: async (callback) => callback({ session: { deleteMany: async (args) => writes.push(['deleteMany', args]), create: async (args) => writes.push(['create', args]) } }),
  };
  const session = await new AuthService(db).login({ email: 'reader@example.test', password: 'a-secure-password' });
  assert.match(session.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(writes[0][0], 'deleteMany');
  assert.equal(writes[1][1].data.tokenHash.length, 64);
  assert.notEqual(writes[1][1].data.tokenHash, session.token);
  assert.equal(session.user.email, 'reader@example.test');
});

test('auth rejects weak registration password and invalid credentials without leaking details', async () => {
  const service = new AuthService({ user: { findUnique: async () => null } });
  await assert.rejects(() => service.register({ email: 'reader@example.test', password: 'short' }), /Password must be between/);
  await assert.doesNotReject(() => new AuthService({
    user: { create: async () => ({ id: 'user-1', email: 'reader@example.test', fullName: null, role: 'CUSTOMER' }) },
    $transaction: async (callback) => callback({ session: { deleteMany: async () => undefined, create: async () => undefined } }),
  }).register({ email: 'reader@example.test', password: '123456' }));
  await assert.rejects(() => service.login({ email: 'reader@example.test', password: 'wrong-password' }), /Invalid email or password/);
});
